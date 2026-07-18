#!/usr/bin/env tsx
/**
 * Create a **test Prayer** PoW token (non-economic dogfood).
 *
 * - Ticker: tPRAYER
 * - Mint: **1** atom / remint (0 decimals)
 * - PoW: **1 leading zero byte** (toy D — easy mine)
 * - Fixed-D covenant (no Moore clock) so remints do not need locktime/MTP
 *
 * Network height / time: this covenant does **not** read chain height.
 * See docs/CLOCK.md. Production Moore/Ergon tiers use nLockTime ≤ MTP.
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
import { PRAYER_MINT_ATOMS, TOKEN_URL } from '../src/params/consensus.js';

loadEnv({ path: resolve(process.cwd(), '.env') });

const TICKER = 'tPRAYER';
const NAME = 'Test Prayer (toy PoW)';
const DECIMALS = 0;
const POW_BYTES = 1; // toy
const BATONS = 2; // conserve XEC
const INITIAL_MINT = 1_000n;

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
        ticker: TICKER,
        mintPerRemint: Number(PRAYER_MINT_ATOMS),
        powLeadingZeroBytes: POW_BYTES,
        batons: BATONS,
        regime: 'non-economic-test',
      },
      null,
      2,
    ),
  );

  if (wallet.balanceSats < 20_000n) {
    throw new Error(
      `Insufficient XEC: need ≥200 for genesis+handoff, have ${Number(wallet.balanceSats) / 100}`,
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

  const contract = await createPowRemintContract({
    tokenId: genesis.tokenId,
    mintAtoms: PRAYER_MINT_ATOMS,
    difficultyLeadingZeroBytes: POW_BYTES,
  });
  console.log('Prayer PoW address', contract.address);

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
  const livePath = resolve(depDir, 'mainnet-prayer-test.json');
  if (existsSync(livePath)) {
    const prev = JSON.parse(readFileSync(livePath, 'utf8')) as {
      ticker?: string;
    };
    const archive = resolve(
      depDir,
      `mainnet-prayer-test-archived-${(prev.ticker || 'prev').toLowerCase()}-${Date.now()}.json`,
    );
    renameSync(livePath, archive);
    console.log('Archived previous', archive);
  }

  const record = {
    ticker: TICKER,
    name: NAME,
    tokenId: genesis.tokenId,
    mode: 'fixed-pow',
    role: 'prayer-test-non-economic',
    decimals: DECIMALS,
    powAddress: contract.address,
    redeemScriptHex: contract.redeemHex,
    difficultyLeadingZeroBytes: POW_BYTES,
    mintAtomsPerRemint: PRAYER_MINT_ATOMS.toString(),
    tokensPerRemint: Number(PRAYER_MINT_ATOMS),
    initialMintAtoms: INITIAL_MINT.toString(),
    powBatonCount: BATONS,
    genesisTxid: genesis.tokenId,
    handoffTxids,
    authPubkey: toHex(wallet.pk),
    genesisAddress: wallet.address,
    createdAt: new Date().toISOString(),
    explorer: `https://explorer.e.cash/tx/${genesis.tokenId}`,
    cashtab: `https://cashtab.com/#/token/${genesis.tokenId}`,
    notes: [
      'Test Prayer: non-economic ritual chrome, 1 token/remint, toy 1-byte PoW.',
      'Fixed-D covenant — no nLockTime / height clock.',
      'Clock docs: docs/CLOCK.md (MTP used only by Moore/Ergon miners).',
    ],
  };

  writeFileSync(livePath, `${JSON.stringify(record, null, 2)}\n`);
  console.log('\ntPRAYER ready');
  console.log(JSON.stringify(record, null, 2));
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
