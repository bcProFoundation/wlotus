#!/usr/bin/env tsx
/**
 * Create mWLPOW Moore-bit PoW token and lock batons to WlotusPowRemintMoore.
 *
 * Fine-grain D: bits = baseZeroBits + floor((locktime - genesisUnix) / secondsPerExtraBit)
 * Dogfood schedule: +1 bit / day (TEST_MOORE_SECONDS_PER_EXTRA_BIT).
 * Mint always 100. eMPP WLDF announces bits beside ALP MINT.
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
import { broadcastAlpGenesis } from '../src/genesis/broadcastGenesis.js';
import { createPowRemintMooreContract } from '../src/covenant/powRemintMooreScript.js';
import { TEST_MOORE_SECONDS_PER_EXTRA_BIT } from '../src/covenant/wldf.js';
import {
  BASE_MINT_ATOMS,
  MWLPOW_PER_WLOTUS,
  POW_BASE_ZERO_BITS,
  TOKEN_DECIMALS,
  TOKEN_NAME,
  TOKEN_TICKER,
  TOKEN_URL,
} from '../src/params/consensus.js';
import {
  TEST_INITIAL_MINT_ATOMS,
  TEST_POW_BATON_COUNT,
  TEST_TARGET_USD_PER_TOKEN,
} from '../src/params/testEconomics.js';

loadEnv({ path: resolve(process.cwd(), '.env') });

async function main(): Promise<void> {
  const skHex = process.env.GENESIS_SK_HEX?.trim();
  if (!skHex || !/^[0-9a-fA-F]{64}$/.test(skHex)) {
    throw new Error('GENESIS_SK_HEX missing');
  }

  const nowUnix = Math.floor(Date.now() / 1000);
  // Start one Moore step into the schedule so first remint proves fine-grain
  // (bits = 9 = 1 byte + 1 bit) without waiting a day.
  const genesisUnix = Number(
    process.env.MOORE_GENESIS_UNIX?.trim() || nowUnix - TEST_MOORE_SECONDS_PER_EXTRA_BIT,
  );
  const secondsPerExtraBit = Number(
    process.env.MOORE_SECONDS_PER_EXTRA_BIT?.trim() ||
      TEST_MOORE_SECONDS_PER_EXTRA_BIT,
  );
  const baseZeroBits = Number(
    process.env.MOORE_BASE_ZERO_BITS?.trim() || POW_BASE_ZERO_BITS,
  );

  const chronik = await createChronik('closest');
  const wallet = Wallet.fromSk(fromHex(skHex), chronik);
  await wallet.sync();

  console.log(
    JSON.stringify(
      {
        address: wallet.address,
        balanceXec: Number(wallet.balanceSats) / 100,
        ticker: TOKEN_TICKER,
        mode: 'moore-bit',
        genesisUnix,
        baseZeroBits,
        secondsPerExtraBit,
        mintPerRemint: Number(BASE_MINT_ATOMS),
      },
      null,
      2,
    ),
  );

  const genesis = await broadcastAlpGenesis(wallet, {
    ticker: TOKEN_TICKER,
    name: `${TOKEN_NAME} (Moore)`,
    url: TOKEN_URL,
    decimals: TOKEN_DECIMALS,
    initialMintAtoms: TEST_INITIAL_MINT_ATOMS,
    powBatonCount: TEST_POW_BATON_COUNT,
  });
  console.log('Genesis', genesis.tokenId);

  const contract = await createPowRemintMooreContract({
    tokenId: genesis.tokenId,
    mintAtoms: BASE_MINT_ATOMS,
    genesisUnix,
    baseZeroBits,
    secondsPerExtraBit,
  });
  console.log('Moore PoW address', contract.address);

  const handoffTxids: string[] = [];
  for (let i = 0; i < TEST_POW_BATON_COUNT; i++) {
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
    console.log(`Handoff ${i + 1}/${TEST_POW_BATON_COUNT}: ${resp.broadcasted[0]}`);
  }

  const depDir = resolve(process.cwd(), 'deployments');
  mkdirSync(depDir, { recursive: true });
  const livePath = resolve(depDir, 'mainnet-moore-mwlpow.json');
  if (existsSync(livePath)) {
    const archive = resolve(
      depDir,
      `mainnet-moore-mwlpow-archived-${Date.now()}.json`,
    );
    renameSync(livePath, archive);
    console.log('Archived previous Moore deployment to', archive);
  }

  // Also archive fixed-D pointer if present — Moore becomes the active dogfood tip.
  const fixedPath = resolve(depDir, 'mainnet-pow-token.json');
  if (existsSync(fixedPath)) {
    const prev = JSON.parse(readFileSync(fixedPath, 'utf8')) as {
      ticker?: string;
      mode?: string;
    };
    const stamp = `${(prev.ticker || 'prev').toLowerCase()}-${prev.mode || 'fixed'}`;
    const archive = resolve(
      depDir,
      `mainnet-pow-token-archived-${stamp}-${Date.now()}.json`,
    );
    renameSync(fixedPath, archive);
    console.log('Archived previous pow-token pointer to', archive);
  }

  const record = {
    ticker: TOKEN_TICKER,
    name: `${TOKEN_NAME} (Moore)`,
    tokenId: genesis.tokenId,
    mode: 'moore-bit',
    role: 'incubation-moore-test',
    decimals: TOKEN_DECIMALS,
    powAddress: contract.address,
    redeemScriptHex: contract.redeemHex,
    genesisUnix,
    baseZeroBits,
    secondsPerExtraBit,
    difficultyNote:
      'bits = baseZeroBits + floor((nLockTime - genesisUnix) / secondsPerExtraBit); capped +8',
    mintAtomsPerRemint: BASE_MINT_ATOMS.toString(),
    tokensPerRemint: Number(BASE_MINT_ATOMS),
    targetUsdPerToken: TEST_TARGET_USD_PER_TOKEN,
    mwlpowPerWlotus: Number(MWLPOW_PER_WLOTUS),
    initialMintAtoms: TEST_INITIAL_MINT_ATOMS.toString(),
    powBatonCount: TEST_POW_BATON_COUNT,
    genesisTxid: genesis.tokenId,
    handoffTxids,
    authPubkey: toHex(wallet.pk),
    genesisAddress: wallet.address,
    createdAt: new Date().toISOString(),
    explorer: `https://explorer.e.cash/tx/${genesis.tokenId}`,
    cashtab: `https://cashtab.com/#/token/${genesis.tokenId}`,
    notes: [
      'Moore-bit mWLPOW dogfood: fine-grain D from nLockTime (+1 bit/day).',
      'eMPP WLDF announces bits beside ALP MINT (Agora dual-push pattern).',
      'Mint always 100 @ 0 decimals. P2SH address stable across Moore steps.',
      'Cheat note: miner may choose past locktime for easier bits (test OK).',
      'See docs/research/alp-empp-difficulty-state.md and docs/ECONOMICS.md.',
    ],
  };

  writeFileSync(livePath, `${JSON.stringify(record, null, 2)}\n`);
  writeFileSync(
    resolve(depDir, 'mainnet-pow-token.json'),
    `${JSON.stringify(record, null, 2)}\n`,
  );
  writeFileSync(
    resolve(depDir, 'mainnet-mwlpow.json'),
    `${JSON.stringify(record, null, 2)}\n`,
  );
  console.log('\nMoore mWLPOW PoW token ready');
  console.log(JSON.stringify(record, null, 2));
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
