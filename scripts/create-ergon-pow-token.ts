#!/usr/bin/env tsx
/**
 * Create mWLPOW Ergon-daily-δ PoW token (compact target × 99918/100000 per day).
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
import { createPowRemintErgonContract } from '../src/covenant/powRemintErgonScript.js';
import {
  buildErgonTargetTable,
  ERGON_DAY_SECONDS_DEFAULT,
  ERGON_GENESIS_TARGET,
  ERGON_MAX_DAYS,
} from '../src/covenant/ergon.js';
import {
  BASE_MINT_ATOMS,
  MWLPOW_PER_WLOTUS,
  TOKEN_DECIMALS,
  TOKEN_NAME,
  TOKEN_TICKER,
  TOKEN_URL,
} from '../src/params/consensus.js';
import {
  TEST_INITIAL_MINT_ATOMS,
  TEST_TARGET_USD_PER_TOKEN,
} from '../src/params/testEconomics.js';

loadEnv({ path: resolve(process.cwd(), '.env') });

/** Fewer batons to conserve XEC after prior dogfood deploys. */
const ERGON_BATON_COUNT = 2;

async function main(): Promise<void> {
  const skHex = process.env.GENESIS_SK_HEX?.trim();
  if (!skHex || !/^[0-9a-fA-F]{64}$/.test(skHex)) {
    throw new Error('GENESIS_SK_HEX missing');
  }

  const nowUnix = Math.floor(Date.now() / 1000);
  const daySeconds = Number(
    process.env.ERGON_DAY_SECONDS?.trim() || ERGON_DAY_SECONDS_DEFAULT,
  );
  // Backdate one Moore day so first remint exercises δ^1 (not only genesis T0).
  const genesisUnix = Number(
    process.env.ERGON_GENESIS_UNIX?.trim() || nowUnix - daySeconds,
  );
  const genesisTarget = Number(
    process.env.ERGON_GENESIS_TARGET?.trim() || ERGON_GENESIS_TARGET,
  );

  const chronik = await createChronik('closest');
  const wallet = Wallet.fromSk(fromHex(skHex), chronik);
  await wallet.sync();

  const table = buildErgonTargetTable(genesisTarget);
  console.log(
    JSON.stringify(
      {
        address: wallet.address,
        balanceXec: Number(wallet.balanceSats) / 100,
        mode: 'ergon-daily-delta',
        genesisUnix,
        daySeconds,
        genesisTarget,
        targets: [...Array(ERGON_MAX_DAYS + 1)].map((_, d) =>
          table.readUInt32LE(d * 4),
        ),
      },
      null,
      2,
    ),
  );

  const genesis = await broadcastAlpGenesis(wallet, {
    ticker: TOKEN_TICKER,
    name: `${TOKEN_NAME} (Ergon δ)`,
    url: TOKEN_URL,
    decimals: TOKEN_DECIMALS,
    initialMintAtoms: TEST_INITIAL_MINT_ATOMS,
    powBatonCount: ERGON_BATON_COUNT,
  });
  console.log('Genesis', genesis.tokenId);

  const contract = await createPowRemintErgonContract({
    tokenId: genesis.tokenId,
    mintAtoms: BASE_MINT_ATOMS,
    genesisUnix,
    daySeconds,
    genesisTarget,
  });
  console.log('Ergon PoW address', contract.address);
  if (contract.redeemHex.length / 2 > 520) {
    throw new Error(
      `Redeem ${contract.redeemHex.length / 2}B exceeds 520B push limit`,
    );
  }

  const handoffTxids: string[] = [];
  for (let i = 0; i < ERGON_BATON_COUNT; i++) {
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
    handoffTxids.push(resp.broadcasted[0]);
    console.log(`Handoff ${i + 1}/${ERGON_BATON_COUNT}: ${resp.broadcasted[0]}`);
  }

  const depDir = resolve(process.cwd(), 'deployments');
  mkdirSync(depDir, { recursive: true });
  const livePath = resolve(depDir, 'mainnet-ergon-mwlpow.json');
  if (existsSync(livePath)) {
    renameSync(
      livePath,
      resolve(depDir, `mainnet-ergon-mwlpow-archived-${Date.now()}.json`),
    );
  }

  const record = {
    ticker: TOKEN_TICKER,
    name: `${TOKEN_NAME} (Ergon δ)`,
    tokenId: genesis.tokenId,
    mode: 'ergon-daily-delta',
    role: 'incubation-ergon-test',
    decimals: TOKEN_DECIMALS,
    powAddress: contract.address,
    redeemScriptHex: contract.redeemHex,
    genesisUnix,
    daySeconds,
    genesisTarget,
    maxDays: ERGON_MAX_DAYS,
    mooreNum: 99918,
    mooreDen: 100000,
    targetTableHex: contract.targetTable.toString('hex'),
    difficultyNote:
      'Ergon daily δ: target_d = floor(T0 * 99918^d / 100000^d); WLDF v2 stores day+target',
    mintAtomsPerRemint: BASE_MINT_ATOMS.toString(),
    tokensPerRemint: Number(BASE_MINT_ATOMS),
    targetUsdPerToken: TEST_TARGET_USD_PER_TOKEN,
    mwlpowPerWlotus: Number(MWLPOW_PER_WLOTUS),
    initialMintAtoms: TEST_INITIAL_MINT_ATOMS.toString(),
    powBatonCount: ERGON_BATON_COUNT,
    genesisTxid: genesis.tokenId,
    handoffTxids,
    authPubkey: toHex(wallet.pk),
    genesisAddress: wallet.address,
    createdAt: new Date().toISOString(),
    explorer: `https://explorer.e.cash/tx/${genesis.tokenId}`,
    cashtab: `https://cashtab.com/#/token/${genesis.tokenId}`,
    notes: [
      'Ergon-like daily Moore δ=99918/100000 on compact PoW target (not +1 bit/day).',
      'eMPP WLDF v2 announces dayIndex + target beside ALP MINT.',
      'Dogfood window days 0..4 (precomputed table; Spedn has no Mul).',
      'Half-life ~2.3y; +1 bit ≈ every 840 days at this δ.',
    ],
  };

  writeFileSync(livePath, `${JSON.stringify(record, null, 2)}\n`);
  console.log('\nErgon mWLPOW ready');
  console.log(JSON.stringify(record, null, 2));
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
