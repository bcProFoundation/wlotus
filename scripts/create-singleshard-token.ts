#!/usr/bin/env tsx
/**
 * Create the single-shard δ experiment token (VLOTUS v3, research —
 * k==1-only: every remint advances exactly 1 day).
 *
 * ALP genesis with 1 mint baton, handed off to the hand-assembled shard
 * P2SH at tip (day 0, genesisTarget). Fund GENESIS_ADDRESS first.
 *
 * Env overrides: UDELTA_TICKER, UDELTA_NAME, UDELTA_DEP, UDELTA_GENESIS_UNIX,
 * UDELTA_DAY_SECONDS, UDELTA_GENESIS_TARGET (must be ≤ 2^24 — same
 * 32-bit-arithmetic safety invariant as the two-shard experiment).
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
import { createSingleShardDeltaContract } from '../src/covenant/singleShardDeltaScript.js';
import {
  TWO_SHARD_DAY_SECONDS_DEFAULT,
  TWO_SHARD_GENESIS_TARGET_DEFAULT,
} from '../src/covenant/twoShardMath.js';
import {
  BASE_MINT_ATOMS,
  TOKEN_DECIMALS,
  TOKEN_URL,
} from '../src/params/consensus.js';

loadEnv({ path: resolve(process.cwd(), '.env') });

const UDELTA_TICKER_DEFAULT = 'VLOTUS';
const UDELTA_NAME_DEFAULT = 'Velocity Lotus v3 (k=1-only experiment)';

async function main(): Promise<void> {
  const skHex = process.env.GENESIS_SK_HEX?.trim();
  if (!skHex || !/^[0-9a-fA-F]{64}$/.test(skHex)) {
    throw new Error('GENESIS_SK_HEX missing (see npm run new-experiment-wallet)');
  }

  const nowUnix = Math.floor(Date.now() / 1000);
  const ticker =
    process.env.UDELTA_TICKER?.trim() || UDELTA_TICKER_DEFAULT;
  const name = process.env.UDELTA_NAME?.trim() || UDELTA_NAME_DEFAULT;
  const depName = process.env.UDELTA_DEP?.trim() || 'mainnet-vlotus.json';
  const daySeconds = Number(
    process.env.UDELTA_DAY_SECONDS?.trim() ||
      TWO_SHARD_DAY_SECONDS_DEFAULT,
  );
  // v3 default: born ~49h stale so slots 1 AND 2 are already open — the
  // first two k=1 ticks demo catch-up (2 sequential advances + ratchets)
  // in one session. Override with UDELTA_GENESIS_UNIX for a fresh tip.
  const genesisUnix = Number(
    process.env.UDELTA_GENESIS_UNIX?.trim() || nowUnix - 176400,
  );
  const genesisTarget = Number(
    process.env.UDELTA_GENESIS_TARGET?.trim() ||
      TWO_SHARD_GENESIS_TARGET_DEFAULT,
  );
  if (
    !Number.isInteger(genesisTarget) ||
    genesisTarget <= 0 ||
    genesisTarget > 2 ** 24
  ) {
    throw new Error(
      `UDELTA_GENESIS_TARGET must be an integer in (0, 2^24], got ${genesisTarget}`,
    );
  }

  const chronik = await createChronik('closest');
  const wallet = Wallet.fromSk(fromHex(skHex), chronik);
  await wallet.sync();

  console.log(
    JSON.stringify(
      {
        address: wallet.address,
        balanceXec: Number(wallet.balanceSats) / 100,
        mode: 'single-shard-delta-v3',
        ticker,
        genesisUnix,
        daySeconds,
        genesisTarget,
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

  const shard = createSingleShardDeltaContract({
    tokenId: genesis.tokenId,
    mintAtoms: BASE_MINT_ATOMS,
    genesisUnix,
    daySeconds,
    genesisTarget,
    tipDay: 0,
    tipTarget: genesisTarget,
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
    mode: 'single-shard-delta-v3',
    role: 'experiment-multiinput-v3',
    decimals: TOKEN_DECIMALS,
    powAddress: shard.address,
    redeemScriptHex: shard.redeemHex,
    codeHashHex: shard.codeHash.toString('hex'),
    prefixHashHex: shard.prefixHash.toString('hex'),
    genesisUnix,
    daySeconds,
    genesisTarget,
    stepCapK: 1,
    stepNote:
      'SUB form: t ← t − floor(t·82/100000), explicit double-and-add, no OP_MUL; EXACTLY k=1/remint (k=0 forbidden — race economics)',
    difficultyNote:
      'Single-shard δ v3: hand-assembled 404B/164-op redeem — PoW + k==1-only δ derivation + WLDF v4/ALP pins + VERIFIED successors (Moore econ trick, 9B state) + schnorr auth.',
    mintAtomsPerRemint: BASE_MINT_ATOMS.toString(),
    tokensPerRemint: Number(BASE_MINT_ATOMS),
    initialMintAtoms: '1000',
    powBatonCount: 1,
    genesisTxid: genesis.tokenId,
    handoffTxids: [] as string[],
    pendingHandoffs: true,
    partial: true,
    tipDay: 0,
    tipTarget: genesisTarget,
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
      `Handoff failed: ${JSON.stringify(resp)} (partial dep saved — run resume-singleshard-handoff)`,
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
