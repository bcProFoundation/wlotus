#!/usr/bin/env tsx
/**
 * Create a NEW PoW-mineable ALP test token and lock batons to the Spedn covenant.
 *
 * Note: The earlier introspection-based handoff permanently locked 4 WLTEST batons
 * (eCash has no OP_OUTPUTBYTECODE etc.). This script creates a fresh token.
 */
import { resolve } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
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
  POW_LEADING_ZERO_BYTES,
  TOKEN_DECIMALS,
  TOKEN_URL,
} from '../src/params/consensus.js';
import {
  TEST_INITIAL_MINT_ATOMS,
  TEST_POW_BATON_COUNT,
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
      },
      null,
      2,
    ),
  );

  // 1) Genesis custodial batons (tokenId = txid)
  const genesis = await broadcastAlpGenesis(wallet, {
    ticker: 'WLPOW',
    name: 'White Lotus PoW Test',
    url: TOKEN_URL,
    decimals: TOKEN_DECIMALS,
    initialMintAtoms: TEST_INITIAL_MINT_ATOMS,
    powBatonCount: TEST_POW_BATON_COUNT,
  });
  console.log('Genesis', genesis.tokenId);

  // 2) Build covenant for this tokenId
  const contract = await createPowRemintContract({
    tokenId: genesis.tokenId,
    mintAtoms: BASE_MINT_ATOMS,
    difficultyLeadingZeroBytes: POW_LEADING_ZERO_BYTES,
  });
  console.log('PoW address', contract.address);

  // 3) Handoff each baton to P2SH
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

  const record = {
    ticker: 'WLPOW',
    name: 'White Lotus PoW Test',
    tokenId: genesis.tokenId,
    mode: 'pow',
    powAddress: contract.address,
    redeemScriptHex: contract.redeemHex,
    difficultyLeadingZeroBytes: POW_LEADING_ZERO_BYTES,
    mintAtomsPerRemint: BASE_MINT_ATOMS.toString(),
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
      'PoW covenant is Spedn Mist-style (BIP143 preimage). eCash has no native introspection.',
      'Prior WLTEST introspection P2SH batons are permanently locked.',
      'v1 WLPOW (size-56 trailer) and v2 (0x00 empty-push mint bug) batons are locked.',
      'See mainnet-pow-token-v1-locked.json / mainnet-pow-token-v2-locked.json.',
    ],
  };

  mkdirSync(resolve(process.cwd(), 'deployments'), { recursive: true });
  writeFileSync(
    resolve(process.cwd(), 'deployments/mainnet-pow-token.json'),
    `${JSON.stringify(record, null, 2)}\n`,
  );
  console.log('\nPoW token ready');
  console.log(JSON.stringify(record, null, 2));
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
