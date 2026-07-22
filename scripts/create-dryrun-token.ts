#!/usr/bin/env tsx
/**
 * Legacy dryrun genesis for Prayer | Candle | Flower (MooreTip).
 *
 * **wLotus** (prod + dryrun) uses the unified script instead:
 *   TICKER=dWLOTUS BATONS=28 TEMPLE_ADDRESS=… npm run create-wlotus-token
 *   npm run create-prod-token   # ticker WLOTUS (default)
 *
 *   TIER=prayer npm run create-dryrun-token
 *   TIER=candle npm run create-dryrun-token
 *   TIER=flower npm run create-dryrun-token
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
import { getMedianTimePast } from '../src/network/medianTimePast.js';
import { broadcastAlpGenesis } from '../src/genesis/broadcastGenesis.js';
import { createPowRemintMooreTipContract } from '../src/covenant/powRemintMooreTipScript.js';
import { createPowRemintMooreTipMemoContract } from '../src/covenant/powRemintMooreTipMemoScript.js';
import { resolveProdSecondsPerExtraBit } from '../src/covenant/mooreTip.js';
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

const SECONDS_PER_EXTRA_BIT = resolveProdSecondsPerExtraBit(
  process.env.MOORE_DAYS_PER_EXTRA_BIT,
);

type Tier = 'prayer' | 'candle' | 'flower';

const TIERS: Record<
  Tier,
  { ticker: string; name: string; bits: number; mint: bigint; batons: number }
> = {
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
  const tierName = (process.env.TIER?.trim().toLowerCase() || 'prayer') as string;
  if (tierName === 'wlotus') {
    throw new Error(
      'TIER=wlotus moved to create-wlotus-token (same covenant for prod + dryrun).\n' +
        '  Test:  TICKER=dWLOTUS BATONS=28 TEMPLE_ADDRESS=… npm run create-wlotus-token\n' +
        '  Prod:  TEMPLE_ADDRESS=… BATONS=28 npm run create-wlotus-token\n' +
        '  Alias: npm run create-dryrun-wlotus  /  npm run create-prod-token',
    );
  }
  const tier = TIERS[tierName as Tier];
  if (!tier) {
    throw new Error(
      `Unknown TIER=${tierName}; use prayer|candle|flower (wLotus → create-wlotus-token)`,
    );
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
        initialMintAtoms: 1000,
        secondsPerExtraBit: SECONDS_PER_EXTRA_BIT,
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

  const minSats = 8_000n + BigInt(batons) * 3_000n;
  if (wallet.balanceSats < minSats) {
    throw new Error(
      `Insufficient XEC: need ≥${Number(minSats) / 100} for ${batons} batons, have ${Number(wallet.balanceSats) / 100}`,
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
          secondsPerExtraBit: SECONDS_PER_EXTRA_BIT,
          tipLocktime,
        })
      : await createPowRemintMooreTipContract({
          tokenId: genesis.tokenId,
          mintAtoms: tier.mint,
          genesisUnix,
          baseZeroBits: tier.bits,
          secondsPerExtraBit: SECONDS_PER_EXTRA_BIT,
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
  const fileStem = `mainnet-dryrun-${tierName}`;
  const livePath = resolve(depDir, `${fileStem}.json`);
  if (existsSync(livePath)) {
    const archive = resolve(
      depDir,
      `${fileStem}-archived-${Date.now()}.json`,
    );
    renameSync(livePath, archive);
    console.log('Archived', archive);
  }

  const covenantName =
    tierName === 'prayer'
      ? 'WlotusPowRemintMooreTipMemo'
      : 'WlotusPowRemintMooreTip';

  const record = {
    tier: tierName,
    ticker: tier.ticker,
    name: tier.name,
    tokenId: genesis.tokenId,
    mode:
      tierName === 'prayer'
        ? 'moore-tip-memo-hard-bind'
        : 'moore-tip-hard-bind',
    role: 'production-dryrun',
    covenant: covenantName,
    decimals: 0,
    powAddress: contract.address,
    redeemScriptHex: contract.redeemHex,
    codeHashHex: toHex(contract.codeHash),
    codeBytesHex: toHex(contract.codeBytes),
    prefixHashHex: toHex(contract.prefixHash),
    tipValueOffset: contract.tipValueOffset,
    genesisUnix,
    baseZeroBits: tier.bits,
    secondsPerExtraBit: SECONDS_PER_EXTRA_BIT,
    tipLocktime,
    mintAtomsPerRemint: tier.mint.toString(),
    initialMintAtoms: '1000',
    mintSplit: null,
    templeAddress: null,
    templeScriptHashHex: null,
    templeRedeemHex: null,
    templeDryrunWrappedP2pkh: null,
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
      'Moore D: +1 bit / 500 days (override MOORE_DAYS_PER_EXTRA_BIT=365..730). Cap bits ≤ 128.',
      tierName === 'prayer'
        ? 'Prayer memo mint: 1 atom/remint to desk; DANA memorial in mint OP_RETURN (no burn tx).'
        : 'Candle/Flower use MooreTip without memorial push.',
      'For wLotus use: npm run create-wlotus-token (TICKER=dWLOTUS|WLOTUS).',
    ],
  };

  writeFileSync(livePath, `${JSON.stringify(record, null, 2)}\n`);
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
