#!/usr/bin/env tsx
/**
 * Create the two-shard (C+M) Ergon-δ experiment token (SHARD, research).
 *
 * ALP genesis with 2 mint batons, handed off to the C and M shard P2SH
 * addresses at tip (day 0, genesisTarget). Fund GENESIS_ADDRESS first
 * (see deployments/pending-multiinput-funding.json).
 *
 * Env overrides: TWOSHARD_TICKER, TWOSHARD_GENESIS_UNIX,
 * TWOSHARD_DAY_SECONDS, TWOSHARD_GENESIS_TARGET (must be ≤ 2^24 —
 * the dropped covenant invariant, enforced here at genesis).
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
import { createTwoShardPair } from '../src/covenant/twoShardScript.js';
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

const TWOSHARD_BATON_COUNT = 2;
const TWOSHARD_TICKER_DEFAULT = 'SHARD';
const TWOSHARD_NAME_DEFAULT = 'TwoShard Experiment';

async function main(): Promise<void> {
  const skHex = process.env.GENESIS_SK_HEX?.trim();
  if (!skHex || !/^[0-9a-fA-F]{64}$/.test(skHex)) {
    throw new Error('GENESIS_SK_HEX missing (see npm run new-experiment-wallet)');
  }

  const nowUnix = Math.floor(Date.now() / 1000);
  const ticker =
    process.env.TWOSHARD_TICKER?.trim() || TWOSHARD_TICKER_DEFAULT;
  const daySeconds = Number(
    process.env.TWOSHARD_DAY_SECONDS?.trim() ||
      TWO_SHARD_DAY_SECONDS_DEFAULT,
  );
  const genesisUnix = Number(
    process.env.TWOSHARD_GENESIS_UNIX?.trim() || nowUnix - 3600,
  );
  const genesisTarget = Number(
    process.env.TWOSHARD_GENESIS_TARGET?.trim() ||
      TWO_SHARD_GENESIS_TARGET_DEFAULT,
  );
  // Dropped covenant invariant (diet): keep 32-bit arithmetic provably
  // safe — t·82 < 2^31 requires target ≤ 2^24 (with margin).
  if (
    !Number.isInteger(genesisTarget) ||
    genesisTarget <= 0 ||
    genesisTarget > 2 ** 24
  ) {
    throw new Error(
      `TWOSHARD_GENESIS_TARGET must be an integer in (0, 2^24], got ${genesisTarget}`,
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
        mode: 'two-shard-c+m',
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
    name: TWOSHARD_NAME_DEFAULT,
    url: TOKEN_URL,
    decimals: TOKEN_DECIMALS,
    initialMintAtoms: 1_000n,
    powBatonCount: TWOSHARD_BATON_COUNT,
    // Thin experiment wallet: real fees are ~10 sats (dust dominates).
    feeHeadroomSats: 500n,
  });
  console.log('Genesis', genesis.tokenId);

  const pair = await createTwoShardPair({
    tokenId: genesis.tokenId,
    mintAtoms: BASE_MINT_ATOMS,
    genesisUnix,
    daySeconds,
    genesisTarget,
    tipDay: 0,
    tipTarget: genesisTarget,
  });
  console.log('C shard', pair.c.address);
  console.log('M shard', pair.m.address);
  for (const shard of [pair.c, pair.m]) {
    if (shard.redeem.length > 520) {
      throw new Error(
        `${shard.id} redeem ${shard.redeem.length}B exceeds 520B push limit`,
      );
    }
  }

  const depDir = resolve(process.cwd(), 'deployments');
  mkdirSync(depDir, { recursive: true });
  const livePath = resolve(depDir, 'mainnet-twoshard-shard.json');
  if (existsSync(livePath)) {
    renameSync(
      livePath,
      resolve(depDir, `mainnet-twoshard-shard-archived-${Date.now()}.json`),
    );
  }

  // Partial record FIRST (durable): if a handoff fails (wallet sync lag,
  // empty fee pot), resume-twoshard-handoffs.ts completes from this file
  // instead of burning a fresh genesis.
  const partial = {
    ticker,
    name: TWOSHARD_NAME_DEFAULT,
    tokenId: genesis.tokenId,
    mode: 'two-shard-c+m',
    role: 'experiment-multiinput-v1',
    decimals: TOKEN_DECIMALS,
    powAddressC: pair.c.address,
    powAddressM: pair.m.address,
    redeemScriptHexC: pair.c.redeemHex,
    redeemScriptHexM: pair.m.redeemHex,
    genesisUnix,
    daySeconds,
    genesisTarget,
    stepCapK: 1,
    stepNote:
      'SUB form: t ← t − floor(t·82/100000), explicit double-and-add, no OP_MUL',
    difficultyNote:
      'Two-shard Ergon δ: C derives (newDay,newTarget) K=1-bounded; M checks PoW vs witness; identical 4-output pins bind them. Successors unverified witness (ergon-dogfood posture).',
    mintAtomsPerRemint: BASE_MINT_ATOMS.toString(),
    tokensPerRemint: Number(BASE_MINT_ATOMS),
    initialMintAtoms: '1000',
    powBatonCount: TWOSHARD_BATON_COUNT,
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

  const shards = [pair.c, pair.m];
  const handoffTxids: string[] = [];
  for (let i = 0; i < TWOSHARD_BATON_COUNT; i++) {
    await wallet.sync();
    const action: payment.Action = {
      outputs: [
        { sats: 0n },
        {
          sats: DEFAULT_DUST_SATS,
          script: shards[i]!.p2shScript,
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
      writeFileSync(
        livePath,
        `${JSON.stringify({ ...partial, handoffTxids }, null, 2)}\n`,
      );
      throw new Error(
        `Handoff ${i} failed: ${JSON.stringify(resp)} (partial dep saved — run resume-twoshard-handoffs)`,
      );
    }
    handoffTxids.push(resp.broadcasted[0]);
    console.log(
      `Handoff ${shards[i]!.id} (${i + 1}/${TWOSHARD_BATON_COUNT}): ${resp.broadcasted[0]}`,
    );
  }

  const record = {
    ...partial,
    handoffTxids,
    pendingHandoffs: false,
    completedAt: new Date().toISOString(),
  };
  delete (record as { partial?: boolean }).partial;

  writeFileSync(livePath, `${JSON.stringify(record, null, 2)}\n`);
  console.log('\nTwoShard SHARD ready');
  console.log(JSON.stringify(record, null, 2));
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
