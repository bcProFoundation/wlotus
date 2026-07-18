#!/usr/bin/env tsx
/**
 * Create a **test Prayer tip** PoW token (stateful tip + multi-baton).
 *
 * - Ticker: tPRAYTIP
 * - Mint: **1** atom / remint
 * - PoW: baseZeroBits=1 + tipActivity (bumps when remints are closer than minGap)
 * - Per-baton tipLocktime anti-rewind; N batons = N independent tips
 *
 * See docs/CLOCK.md (stateful tip design).
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
import {
  createPowRemintPrayerTipContract,
  TEST_PRAYER_TIP_BASE_ZERO_BITS,
  TEST_PRAYER_TIP_COOL_GAP_SECONDS,
  TEST_PRAYER_TIP_MIN_GAP_SECONDS,
} from '../src/covenant/powRemintPrayerTipScript.js';
import { PRAYER_MINT_ATOMS, TOKEN_URL } from '../src/params/consensus.js';

loadEnv({ path: resolve(process.cwd(), '.env') });

const TICKER = 'tPRAYTIP';
const NAME = 'Test Prayer Tip (stateful)';
const DECIMALS = 0;
const BATONS = 2;
const INITIAL_MINT = 1_000n;

async function main(): Promise<void> {
  const skHex = process.env.GENESIS_SK_HEX?.trim();
  if (!skHex || !/^[0-9a-fA-F]{64}$/.test(skHex)) {
    throw new Error('GENESIS_SK_HEX missing');
  }

  const chronik = await createChronik('closest');
  const { mtp, tipHeight } = await getMedianTimePast(chronik);
  const genesisUnix = Number(
    process.env.PRAYER_TIP_GENESIS_UNIX?.trim() || mtp,
  );
  const tipLocktime = genesisUnix;
  const tipActivity = 0;

  const wallet = Wallet.fromSk(fromHex(skHex), chronik);
  await wallet.sync();

  console.log(
    JSON.stringify(
      {
        address: wallet.address,
        balanceXec: Number(wallet.balanceSats) / 100,
        ticker: TICKER,
        mintPerRemint: Number(PRAYER_MINT_ATOMS),
        baseZeroBits: TEST_PRAYER_TIP_BASE_ZERO_BITS,
        minGapSeconds: TEST_PRAYER_TIP_MIN_GAP_SECONDS,
        coolGapSeconds: TEST_PRAYER_TIP_COOL_GAP_SECONDS,
        genesisUnix,
        tipLocktime,
        tipActivity,
        batons: BATONS,
        tipHeight,
        mtp,
        regime: 'non-economic-tip-test',
      },
      null,
      2,
    ),
  );

  if (wallet.balanceSats < 25_000n) {
    throw new Error(
      `Insufficient XEC: need ≥250 for genesis+handoff, have ${Number(wallet.balanceSats) / 100}`,
    );
  }

  const genesis = await broadcastAlpGenesis(wallet, {
    ticker: TICKER,
    name: NAME,
    url: TOKEN_URL,
    decimals: DECIMALS,
    initialMintAtoms: INITIAL_MINT,
    powBatonCount: BATONS,
  });
  console.log('Genesis', genesis.tokenId);

  const contract = await createPowRemintPrayerTipContract({
    tokenId: genesis.tokenId,
    mintAtoms: PRAYER_MINT_ATOMS,
    genesisUnix,
    baseZeroBits: TEST_PRAYER_TIP_BASE_ZERO_BITS,
    minGapSeconds: TEST_PRAYER_TIP_MIN_GAP_SECONDS,
    coolGapSeconds: TEST_PRAYER_TIP_COOL_GAP_SECONDS,
    tipLocktime,
    tipActivity,
  });
  console.log('Prayer tip PoW address', contract.address);
  console.log('redeem bytes', contract.redeemScriptBuf.length);

  const handoffTxids: string[] = [];
  for (let i = 0; i < BATONS; i++) {
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
    console.log(`Handoff ${i + 1}/${BATONS}: ${resp.broadcasted[0]}`);
  }

  const depDir = resolve(process.cwd(), 'deployments');
  mkdirSync(depDir, { recursive: true });
  const livePath = resolve(depDir, 'mainnet-prayer-tip-test.json');
  if (existsSync(livePath)) {
    const prev = JSON.parse(readFileSync(livePath, 'utf8')) as {
      ticker?: string;
    };
    const archive = resolve(
      depDir,
      `mainnet-prayer-tip-test-archived-${(prev.ticker || 'prev').toLowerCase()}-${Date.now()}.json`,
    );
    renameSync(livePath, archive);
    console.log('Archived previous', archive);
  }

  const record = {
    ticker: TICKER,
    name: NAME,
    tokenId: genesis.tokenId,
    mode: 'prayer-tip',
    role: 'prayer-tip-test-non-economic',
    decimals: DECIMALS,
    powAddress: contract.address,
    redeemScriptHex: contract.redeemHex,
    genesisUnix,
    baseZeroBits: TEST_PRAYER_TIP_BASE_ZERO_BITS,
    minGapSeconds: TEST_PRAYER_TIP_MIN_GAP_SECONDS,
    coolGapSeconds: TEST_PRAYER_TIP_COOL_GAP_SECONDS,
    tipLocktime,
    tipActivity,
    mintAtomsPerRemint: PRAYER_MINT_ATOMS.toString(),
    tokensPerRemint: Number(PRAYER_MINT_ATOMS),
    initialMintAtoms: INITIAL_MINT.toString(),
    powBatonCount: BATONS,
    /** Per-baton tip tracker (address → tip). Same tip at genesis for all. */
    batonTips: Array.from({ length: BATONS }, (_, i) => ({
      index: i,
      tipLocktime,
      tipActivity,
      powAddress: contract.address,
      lastRemintTxid: null as string | null,
    })),
    genesisTxid: genesis.tokenId,
    handoffTxids,
    authPubkey: toHex(wallet.pk),
    genesisAddress: wallet.address,
    createdAt: new Date().toISOString(),
    explorer: `https://explorer.e.cash/tx/${genesis.tokenId}`,
    cashtab: `https://cashtab.com/#/token/${genesis.tokenId}`,
    notes: [
      'Test Prayer tip: stateful tipLocktime + tipActivity per baton.',
      'gap < minGapSeconds → activity+1 → bits = base + activity (concurrent pray bump).',
      'gap ≥ coolGapSeconds → activity−1. N batons = N independent tips.',
      'Soft nextRedeem binding (hash160 + nextTip* args). Clock: docs/CLOCK.md.',
    ],
  };

  writeFileSync(livePath, `${JSON.stringify(record, null, 2)}\n`);
  console.log('\ntPRAYTIP ready');
  console.log(JSON.stringify(record, null, 2));
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
