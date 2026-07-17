#!/usr/bin/env tsx
/**
 * Create mWLPOW (incubation) PoW token and lock batons to the Spedn covenant.
 *
 * Economics: always 100 / remint @ 0 decimals, ~$1e-5/token target,
 * 1 leading zero byte PoW. See docs/ECONOMICS.md.
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
import { createPowRemintContract } from '../src/covenant/powRemintScript.js';
import {
  BASE_MINT_ATOMS,
  MWLPOW_PER_WLOTUS,
  POW_LEADING_ZERO_BYTES,
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

  const chronik = await createChronik('closest');
  const wallet = Wallet.fromSk(fromHex(skHex), chronik);
  await wallet.sync();

  console.log(
    JSON.stringify(
      {
        address: wallet.address,
        balanceXec: Number(wallet.balanceSats) / 100,
        ticker: TOKEN_TICKER,
        decimals: TOKEN_DECIMALS,
        mintPerRemint: Number(BASE_MINT_ATOMS),
        targetUsdPerToken: TEST_TARGET_USD_PER_TOKEN,
      },
      null,
      2,
    ),
  );

  const genesis = await broadcastAlpGenesis(wallet, {
    ticker: TOKEN_TICKER,
    name: TOKEN_NAME,
    url: TOKEN_URL,
    decimals: TOKEN_DECIMALS,
    initialMintAtoms: TEST_INITIAL_MINT_ATOMS,
    powBatonCount: TEST_POW_BATON_COUNT,
  });
  console.log('Genesis', genesis.tokenId);

  const contract = await createPowRemintContract({
    tokenId: genesis.tokenId,
    mintAtoms: BASE_MINT_ATOMS,
    difficultyLeadingZeroBytes: POW_LEADING_ZERO_BYTES,
  });
  console.log('PoW address', contract.address);

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
  const livePath = resolve(depDir, 'mainnet-pow-token.json');
  if (existsSync(livePath)) {
    const prev = JSON.parse(readFileSync(livePath, 'utf8')) as {
      ticker?: string;
    };
    const stamp = (prev.ticker || 'prev').toLowerCase();
    const archive = resolve(
      depDir,
      `mainnet-pow-token-archived-${stamp}-${Date.now()}.json`,
    );
    renameSync(livePath, archive);
    console.log('Archived previous deployment to', archive);
  }

  const record = {
    ticker: TOKEN_TICKER,
    name: TOKEN_NAME,
    tokenId: genesis.tokenId,
    mode: 'pow',
    role: 'incubation',
    decimals: TOKEN_DECIMALS,
    powAddress: contract.address,
    redeemScriptHex: contract.redeemHex,
    difficultyLeadingZeroBytes: POW_LEADING_ZERO_BYTES,
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
      'mWLPOW incubation: always 100/remint, 0 decimals, 1-byte PoW.',
      'Target ~$0.00001/token (~1/1000 of future WLOTUS at ~$0.01).',
      'Moore δ=99918/100000 applies to work schedule (lib); mint size fixed.',
      'Burn = sacrifice; remint = pure PoW. See docs/ECONOMICS.md.',
    ],
  };

  writeFileSync(livePath, `${JSON.stringify(record, null, 2)}\n`);
  writeFileSync(
    resolve(depDir, 'mainnet-mwlpow.json'),
    `${JSON.stringify(record, null, 2)}\n`,
  );
  console.log('\nmWLPOW PoW token ready');
  console.log(JSON.stringify(record, null, 2));
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
