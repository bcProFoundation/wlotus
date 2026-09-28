#!/usr/bin/env tsx
/**
 * Create the single-shard δ v5 experiment token (durable generation:
 * nBits difficulty, DIV-δ 12.00%/yr, 64-bit PoW, WLDF v6).
 *
 * ALP genesis with 1 mint baton, handed off to the v5 P2SH at tip
 * (slot 0, genesisM/genesisE). Fund GENESIS_ADDRESS first.
 *
 * Env overrides: UDELTA_TICKER (default ELOTUS5), UDELTA_NAME,
 * UDELTA_DEP (default mainnet-v5base.json), UDELTA_GENESIS_UNIX,
 * UDELTA_DAY_SECONDS (slot length; default 600),
 * UDELTA_GENESIS_M (default 2^24 = base scale),
 * UDELTA_GENESIS_E (default 4 = base scale; grand = m 2^30 / e 2).
 */
import { resolve } from 'node:path';
import {
  writeFileSync,
  mkdirSync,
  renameSync,
  existsSync,
} from 'node:fs';
import { config as loadEnv } from 'dotenv';
import { Wallet } from 'ecash-wallet';
import {
  ALP_TOKEN_TYPE_STANDARD,
  DEFAULT_DUST_SATS,
  fromHex,
  payment,
  toHex,
} from 'ecash-lib';
import { createChronik } from '../src/network/createChronik.js';
import { broadcastAlpGenesis } from '../src/genesis/broadcastGenesis.js';
import { createSingleShardDeltaContractV5 } from '../src/covenant/singleShardDeltaScriptV5.js';
import {
  UDELTA_V5_GENESIS_E_BASE,
  UDELTA_V5_GENESIS_M_BASE,
  UDELTA_V5_SLOT_SECONDS,
} from '../src/covenant/singleShardDeltaMathV5.js';
import {
  BASE_MINT_ATOMS,
  TOKEN_DECIMALS,
  TOKEN_URL,
} from '../src/params/consensus.js';

loadEnv({ path: resolve(process.cwd(), '.env') });

const UDELTA_TICKER_DEFAULT = 'ELOTUS5';
const UDELTA_NAME_DEFAULT = 'Elastic Lotus v5 (durable nBits experiment)';

async function main(): Promise<void> {
  const skHex = process.env.GENESIS_SK_HEX?.trim();
  if (!skHex || !/^[0-9a-fA-F]{64}$/.test(skHex)) {
    throw new Error('GENESIS_SK_HEX missing (see npm run new-experiment-wallet)');
  }

  const nowUnix = Math.floor(Date.now() / 1000);
  const ticker =
    process.env.UDELTA_TICKER?.trim() || UDELTA_TICKER_DEFAULT;
  const name = process.env.UDELTA_NAME?.trim() || UDELTA_NAME_DEFAULT;
  const depName = process.env.UDELTA_DEP?.trim() || 'mainnet-v5base.json';
  const daySeconds = Number(
    process.env.UDELTA_DAY_SECONDS?.trim() || UDELTA_V5_SLOT_SECONDS,
  );
  // Born ~2h stale so ~7 slots are open at birth — the first blocks demo
  // the backlog choice (backfill-then-jump) in one session.
  // Override with UDELTA_GENESIS_UNIX for a fresh tip.
  const genesisUnix = Number(
    process.env.UDELTA_GENESIS_UNIX?.trim() || nowUnix - 7200,
  );
  const genesisM = Number(
    process.env.UDELTA_GENESIS_M?.trim() || UDELTA_V5_GENESIS_M_BASE,
  );
  const genesisE = Number(
    process.env.UDELTA_GENESIS_E?.trim() || UDELTA_V5_GENESIS_E_BASE,
  );
  if (!Number.isInteger(genesisM) || genesisM < 1 || genesisM >= 2 ** 31) {
    throw new Error(`UDELTA_GENESIS_M must be in [1, 2^31), got ${genesisM}`);
  }
  if (!Number.isInteger(genesisE) || genesisE < 0 || genesisE > 4) {
    throw new Error(`UDELTA_GENESIS_E must be in [0, 4], got ${genesisE}`);
  }

  const chronik = await createChronik('closest');
  const wallet = Wallet.fromSk(fromHex(skHex), chronik);
  await wallet.sync();

  console.log(
    JSON.stringify(
      {
        address: wallet.address,
        balanceXec: Number(wallet.balanceSats) / 100,
        mode: 'single-shard-delta-v5',
        ticker,
        genesisUnix,
        daySeconds,
        genesisM,
        genesisE,
        mintAtomsPerRemint: BASE_MINT_ATOMS.toString(),
      },
      null,
      2,
    ),
  );

  const genesis = await broadcastAlpGenesis(wallet, {
    ticker,
    name,
    url: TOKEN_URL,
    decimals: TOKEN_DECIMALS,
    initialMintAtoms: 1_000n,
    powBatonCount: 1,
    allowSingleBaton: true,
    feeHeadroomSats: 500n,
  });
  console.log('Genesis', genesis.tokenId);

  const shard = createSingleShardDeltaContractV5({
    tokenId: genesis.tokenId,
    mintAtoms: BASE_MINT_ATOMS,
    genesisUnix,
    daySeconds,
    tipDay: 0,
    m: genesisM,
    e: genesisE,
  });
  console.log('Shard', shard.address, `${shard.redeem.length}B/${shard.ops}ops`);
  if (shard.redeem.length > 520) {
    throw new Error(
      `redeem ${shard.redeem.length}B exceeds 520B push limit`,
    );
  }

  const depDir = resolve(process.cwd(), 'deployments');
  mkdirSync(depDir, { recursive: true });
  const livePath = resolve(depDir, depName);
  if (existsSync(livePath)) {
    renameSync(
      livePath,
      resolve(
        depDir,
        `${depName.replace(/\.json$/, '')}-archived-${Date.now()}.json`,
      ),
    );
  }

  // Partial record FIRST (durable): if the handoff fails, the resume
  // script completes from this file instead of burning a fresh genesis.
  const partial = {
    ticker,
    name,
    tokenId: genesis.tokenId,
    mode: 'single-shard-delta-v5',
    role: 'experiment-multiinput-v5',
    decimals: TOKEN_DECIMALS,
    powAddress: shard.address,
    redeemScriptHex: shard.redeemHex,
    codeHashHex: shard.codeHash.toString('hex'),
    prefixHashHex: shard.prefixHash.toString('hex'),
    genesisUnix,
    daySeconds,
    genesisM,
    genesisE,
    minAdvanceK: 1,
    maxAdvanceK: null,
    stepNote:
      'DIV form: m ← m − m//463784 (EXACT 12.00%/yr), single DIV, no OP_MUL; renorm m×256/e−1 at m<2^23 (e>0); VERIFY q (terminal HALT at q=0); k>=1 skip-tolerant, EXACTLY ONE step per block regardless of k (difficulty tracks WORK)',
    difficultyNote:
      'Single-shard δ v5: hand-assembled 448B/190-op redeem — u64 PoW (exponent-gated 32-bit form) + nBits DIV-δ (10-min slots, k>=1, 1 step/block, renorm, HALT) + WLDF v6/ALP pins + VERIFIED successors (85B econ, 10B state) + schnorr auth.',
    mintAtomsPerRemint: BASE_MINT_ATOMS.toString(),
    tokensPerRemint: Number(BASE_MINT_ATOMS),
    initialMintAtoms: '1000',
    powBatonCount: 1,
    genesisTxid: genesis.tokenId,
    handoffTxids: [] as string[],
    pendingHandoffs: true,
    partial: true,
    tipDay: 0,
    tipM: genesisM,
    tipE: genesisE,
    lastRemintTxid: null,
    authPubkey: toHex(wallet.pk),
    genesisAddress: wallet.address,
    createdAt: new Date().toISOString(),
    explorer: `https://explorer.e.cash/tx/${genesis.tokenId}`,
    cashtab: `https://cashtab.com/#/token/${genesis.tokenId}`,
  };
  writeFileSync(livePath, `${JSON.stringify(partial, null, 2)}\n`);

  await wallet.sync();
  const action: payment.Action = {
    outputs: [
      { sats: 0n },
      {
        sats: DEFAULT_DUST_SATS,
        script: shard.p2shScript,
        tokenId: genesis.tokenId,
        atoms: 0n,
        isMintBaton: true,
      },
    ],
    tokenActions: [
      {
        type: 'MINT',
        tokenId: genesis.tokenId,
        tokenType: ALP_TOKEN_TYPE_STANDARD,
      },
    ],
  };
  const resp = await wallet.action(action).build().broadcast();
  if (!resp.success || !resp.broadcasted?.length) {
    throw new Error(
      `Handoff failed: ${JSON.stringify(resp)} (partial dep saved — run resume-singleshard-handoff-v5)`,
    );
  }
  console.log(`Handoff: ${resp.broadcasted[0]}`);

  const record = {
    ...partial,
    handoffTxids: [resp.broadcasted[0]],
    pendingHandoffs: false,
    completedAt: new Date().toISOString(),
  };
  delete (record as { partial?: boolean }).partial;

  writeFileSync(livePath, `${JSON.stringify(record, null, 2)}\n`);
  console.log(`\n${ticker} ready`);
  console.log(JSON.stringify(record, null, 2));
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
