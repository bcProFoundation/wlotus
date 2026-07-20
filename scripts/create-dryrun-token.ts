#!/usr/bin/env tsx
/**
 * Dryrun genesis for production MooreTip tiers: Prayer | Candle | Flower.
 *
 * Usage:
 *   TIER=prayer npm run create-dryrun-token
 *   TIER=candle npm run create-dryrun-token
 *   TIER=flower npm run create-dryrun-token
 *
 * Uses hardened WlotusPowRemintMooreTip (codeHash next-P2SH + tipLocktime).
 * Production Moore clock: +1 bit / 840 days. Cap bits ≤ 128.
 */
import { resolve } from 'node:path';
import {
  writeFileSync,
  mkdirSync,
  renameSync,
  existsSync,
  readFileSync,
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
import { getMedianTimePast } from '../src/network/medianTimePast.js';
import { broadcastAlpGenesis } from '../src/genesis/broadcastGenesis.js';
import { createPowRemintMooreTipContract } from '../src/covenant/powRemintMooreTipScript.js';
import { createPowRemintMooreTipMemoContract } from '../src/covenant/powRemintMooreTipMemoScript.js';
import { PROD_SECONDS_PER_EXTRA_BIT } from '../src/covenant/mooreTip.js';
import {
  CANDLE_MINT_ATOMS,
  CANDLE_NAME,
  CANDLE_TICKER,
  FLOWER_MINT_ATOMS,
  FLOWER_NAME,
  FLOWER_TICKER,
  POW_BATON_COUNT,
  PRAYER_MINT_ATOMS,
  PRAYER_NAME,
  PRAYER_TICKER,
  TOKEN_URL,
} from '../src/params/consensus.js';

loadEnv({ path: resolve(process.cwd(), '.env') });

type Tier = 'prayer' | 'candle' | 'flower';

const TIERS: Record<
  Tier,
  { ticker: string; name: string; bits: number; mint: bigint; batons: number }
> = {
  // Whole-byte PoW bases (bits % 8 == 0) required by MooreTip op budget.
  prayer: {
    ticker: `d${PRAYER_TICKER}`,
    name: `${PRAYER_NAME} dryrun`,
    bits: 24,
    mint: PRAYER_MINT_ATOMS,
    batons: POW_BATON_COUNT,
  },
  candle: {
    ticker: `d${CANDLE_TICKER}`,
    name: `${CANDLE_NAME} dryrun`,
    bits: 40,
    mint: CANDLE_MINT_ATOMS,
    batons: POW_BATON_COUNT,
  },
  flower: {
    ticker: `d${FLOWER_TICKER}`,
    name: `${FLOWER_NAME} dryrun`,
    bits: 56,
    mint: FLOWER_MINT_ATOMS,
    batons: POW_BATON_COUNT,
  },
};

async function main(): Promise<void> {
  const tierName = (process.env.TIER?.trim().toLowerCase() || 'prayer') as Tier;
  const tier = TIERS[tierName];
  if (!tier) {
    throw new Error(`Unknown TIER=${tierName}; use prayer|candle|flower`);
  }

  const skHex = process.env.GENESIS_SK_HEX?.trim();
  if (!skHex || !/^[0-9a-fA-F]{64}$/.test(skHex)) {
    throw new Error('GENESIS_SK_HEX missing');
  }

  const chronik = await createChronik('closest');
  const { mtp, tipHeight } = await getMedianTimePast(chronik);
  const genesisUnix = Number(
    process.env.DRYRUN_GENESIS_UNIX?.trim() || Math.max(0, mtp - 120),
  );
  const tipLocktime = genesisUnix;
  const batons = Number(process.env.BATONS?.trim() || tier.batons);
  if (!Number.isFinite(batons) || batons < 2) {
    throw new Error(`BATONS must be >= 2 (got ${batons})`);
  }
  if (batons > POW_BATON_COUNT) {
    throw new Error(
      `BATONS=${batons} exceeds ALP max ${POW_BATON_COUNT} (immutable at genesis)`,
    );
  }

  const wallet = Wallet.fromSk(fromHex(skHex), chronik);
  await wallet.sync();

  console.log(
    JSON.stringify(
      {
        address: wallet.address,
        balanceXec: Number(wallet.balanceSats) / 100,
        tier: tierName,
        ticker: tier.ticker,
        baseZeroBits: tier.bits,
        mintAtoms: Number(tier.mint),
        secondsPerExtraBit: PROD_SECONDS_PER_EXTRA_BIT,
        genesisUnix,
        tipLocktime,
        batons,
        tipHeight,
        mtp,
        regime: 'production-moore-tip-dryrun',
      },
      null,
      2,
    ),
  );

  if (wallet.balanceSats < 15_000n) {
    throw new Error(
      `Insufficient XEC: need ≥150, have ${Number(wallet.balanceSats) / 100}`,
    );
  }

  const genesis = await broadcastAlpGenesis(wallet, {
    ticker: tier.ticker,
    name: tier.name,
    url: TOKEN_URL,
    decimals: 0,
    initialMintAtoms: 1_000n,
    powBatonCount: batons,
  });
  console.log('Genesis', genesis.tokenId);

  const contract =
    tierName === 'prayer'
      ? await createPowRemintMooreTipMemoContract({
          tokenId: genesis.tokenId,
          mintAtoms: tier.mint,
          genesisUnix,
          baseZeroBits: tier.bits,
          secondsPerExtraBit: PROD_SECONDS_PER_EXTRA_BIT,
          tipLocktime,
        })
      : await createPowRemintMooreTipContract({
          tokenId: genesis.tokenId,
          mintAtoms: tier.mint,
          genesisUnix,
          baseZeroBits: tier.bits,
          secondsPerExtraBit: PROD_SECONDS_PER_EXTRA_BIT,
          tipLocktime,
        });
  console.log(
    tierName === 'prayer' ? 'MooreTipMemo address' : 'MooreTip address',
    contract.address,
  );
  console.log('redeem bytes', contract.redeemScriptBuf.length);
  if (contract.redeemScriptBuf.length > 520) {
    throw new Error('Redeem exceeds 520-byte P2SH limit');
  }

  const handoffTxids: string[] = [];
  for (let i = 0; i < batons; i++) {
    await wallet.sync();
    const action: payment.Action = {
      outputs: [
        { sats: 0n },
        {
          sats: DEFAULT_DUST_SATS,
          script: contract.p2shScript,
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
      throw new Error(`Handoff ${i} failed: ${JSON.stringify(resp)}`);
    }
    handoffTxids.push(resp.broadcasted[0]!);
    console.log(`Handoff ${i + 1}/${batons}: ${resp.broadcasted[0]}`);
  }

  const depDir = resolve(process.cwd(), 'deployments');
  mkdirSync(depDir, { recursive: true });
  const livePath = resolve(depDir, `mainnet-dryrun-${tierName}.json`);
  if (existsSync(livePath)) {
    const archive = resolve(
      depDir,
      `mainnet-dryrun-${tierName}-archived-${Date.now()}.json`,
    );
    renameSync(livePath, archive);
    console.log('Archived', archive);
  }

  const record = {
    tier: tierName,
    ticker: tier.ticker,
    name: tier.name,
    tokenId: genesis.tokenId,
    mode:
      tierName === 'prayer' ? 'moore-tip-memo-hard-bind' : 'moore-tip-hard-bind',
    role: 'production-dryrun',
    covenant:
      tierName === 'prayer'
        ? 'WlotusPowRemintMooreTipMemo'
        : 'WlotusPowRemintMooreTip',
    decimals: 0,
    powAddress: contract.address,
    redeemScriptHex: contract.redeemHex,
    codeHashHex: toHex(contract.codeHash),
    codeBytesHex: toHex(contract.codeBytes),
    prefixHashHex: toHex(contract.prefixHash),
    tipValueOffset: contract.tipValueOffset,
    genesisUnix,
    baseZeroBits: tier.bits,
    secondsPerExtraBit: PROD_SECONDS_PER_EXTRA_BIT,
    tipLocktime,
    mintAtomsPerRemint: tier.mint.toString(),
    powBatonCount: batons,
    batonTips: Array.from({ length: batons }, (_, i) => ({
      index: i,
      tipLocktime,
      powAddress: contract.address,
      lastRemintTxid: null as string | null,
    })),
    genesisTxid: genesis.tokenId,
    handoffTxids,
    authPubkey: toHex(wallet.pk),
    genesisAddress: wallet.address,
    createdAt: new Date().toISOString(),
    explorer: `https://explorer.e.cash/tx/${genesis.tokenId}`,
    notes: [
      'Hard next-P2SH via codeHash + tipLocktime anti-rewind.',
      'Moore D: production 840-day bit clock. Cap bits ≤ 128.',
      tierName === 'prayer'
        ? 'Prayer memo mint: 1 atom/remint to desk; WLBR memorial in mint OP_RETURN (no burn tx).'
        : 'Candle/Flower use MooreTip without memorial push.',
      'Ergon not used for production tiers.',
    ],
  };

  writeFileSync(livePath, `${JSON.stringify(record, null, 2)}\n`);
  // Also point default prayer-tip path for miner convenience when TIER=prayer
  if (tierName === 'prayer') {
    writeFileSync(
      resolve(depDir, 'mainnet-dryrun-active.json'),
      `${JSON.stringify(record, null, 2)}\n`,
    );
  }
  console.log('\nDryrun ready');
  console.log(JSON.stringify(record, null, 2));
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
