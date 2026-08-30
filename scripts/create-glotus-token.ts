#!/usr/bin/env tsx
/**
 * Genesis for dogfood GLotus (GlotusPowRemintMooreTip).
 *
 *   GLOTUS_MNEMONIC='…' npm run create-glotus-token
 *
 * Ticker default DGLOTUS (docs: dGLOTUS). Override TICKER=GLOTUS if intended.
 * Mint 108 → miner only. Moore 2×: +1 bit / 845 days. Felt remBits, ALP MINT only.
 */
import { resolve } from 'node:path';
import { writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import {
  ALP_TOKEN_TYPE_STANDARD,
  DEFAULT_DUST_SATS,
  payment,
  toHex,
} from 'ecash-lib';
import { createChronik } from '../src/network/createChronik.js';
import { getMedianTimePast } from '../src/network/medianTimePast.js';
import { broadcastAlpGenesis } from '../src/genesis/broadcastGenesis.js';
import { createPowRemintGlotusTipContract } from '../src/covenant/powRemintGlotusTipScript.js';
import {
  GLOTUS_MINT_ATOMS,
  GLOTUS_MOORE_DAYS_PER_EXTRA_BIT,
  GLOTUS_TOKEN_NAME,
  GLOTUS_TOKEN_TICKER,
  MOORE_DAY_SECONDS,
  POW_BATON_COUNT,
  TOKEN_URL,
} from '../src/params/consensus.js';
import {
  GLOTUS_EXPECTED_GENESIS_ADDRESS,
  loadGlotusGenesisWallet,
} from './glotus-genesis-address.js';

const SECONDS_PER_EXTRA_BIT =
  GLOTUS_MOORE_DAYS_PER_EXTRA_BIT * MOORE_DAY_SECONDS;
const BASE_ZERO_BITS = 0;

function resolveTicker(): string {
  const raw = (process.env.TICKER?.trim() || GLOTUS_TOKEN_TICKER).trim();
  if (!/^[A-Za-z][A-Za-z0-9]{0,15}$/.test(raw)) {
    throw new Error(`Invalid TICKER=${JSON.stringify(raw)}`);
  }
  return raw.toUpperCase();
}

async function main(): Promise<void> {
  const ticker = resolveTicker();
  const batons = Number(process.env.BATONS?.trim() || POW_BATON_COUNT);
  if (!Number.isFinite(batons) || batons < 2) {
    throw new Error(`BATONS must be >= 2 (got ${batons})`);
  }
  if (batons > POW_BATON_COUNT) {
    throw new Error(
      `BATONS=${batons} exceeds ALP max ${POW_BATON_COUNT} (immutable at genesis)`,
    );
  }

  const chronik = await createChronik('closest');
  const { mtp, tipHeight } = await getMedianTimePast(chronik);
  const genesisUnix = Number(
    process.env.GLOTUS_GENESIS_UNIX?.trim() || Math.max(0, mtp - 120),
  );
  const tipLocktime = genesisUnix;

  const wallet = await loadGlotusGenesisWallet(chronik);
  if (wallet.address !== GLOTUS_EXPECTED_GENESIS_ADDRESS) {
    throw new Error(
      `Unexpected genesis address ${wallet.address} (want ${GLOTUS_EXPECTED_GENESIS_ADDRESS})`,
    );
  }

  console.log(
    JSON.stringify(
      {
        address: wallet.address,
        balanceXec: Number(wallet.balanceSats) / 100,
        ticker,
        name: GLOTUS_TOKEN_NAME,
        mintAtoms: Number(GLOTUS_MINT_ATOMS),
        baseZeroBits: BASE_ZERO_BITS,
        secondsPerExtraBit: SECONDS_PER_EXTRA_BIT,
        daysPerBit: GLOTUS_MOORE_DAYS_PER_EXTRA_BIT,
        genesisUnix,
        tipLocktime,
        batons,
        tipHeight,
        mtp,
        covenant: 'GlotusPowRemintMooreTip',
      },
      null,
      2,
    ),
  );

  const fuelReserveSats = 10_000n;
  const minSats = 8_000n + BigInt(batons) * 3_000n + fuelReserveSats;
  if (wallet.balanceSats < minSats) {
    throw new Error(
      `Insufficient XEC: need ≥${Number(minSats) / 100}, have ${Number(wallet.balanceSats) / 100}`,
    );
  }

  const genesis = await broadcastAlpGenesis(wallet, {
    ticker,
    name: GLOTUS_TOKEN_NAME,
    url: TOKEN_URL,
    decimals: 0,
    initialMintAtoms: GLOTUS_MINT_ATOMS,
    powBatonCount: batons,
  });
  console.log('Genesis', genesis.tokenId);

  const contract = await createPowRemintGlotusTipContract({
    tokenId: genesis.tokenId,
    mintAtoms: GLOTUS_MINT_ATOMS,
    genesisUnix,
    baseZeroBits: BASE_ZERO_BITS,
    secondsPerExtraBit: SECONDS_PER_EXTRA_BIT,
    tipLocktime,
  });
  console.log('GLotus PoW address', contract.address);
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

  await wallet.syncAndDiscoverAddresses({ gapLimit: 20 });
  const fuelSized = wallet.utxos.find(
    u => !u.token && u.sats >= 4_000n && u.sats <= 12_000n,
  );
  if (!fuelSized) {
    const peel = await wallet
      .action({ outputs: [{ sats: fuelReserveSats, script: wallet.script }] })
      .build()
      .broadcast();
    if (!peel.success || !peel.broadcasted?.length) {
      throw new Error(`Fuel reserve peel failed: ${JSON.stringify(peel)}`);
    }
    console.log('Reserved remint fuel', peel.broadcasted[0], fuelReserveSats.toString());
  }

  const depDir = resolve(process.cwd(), 'deployments');
  mkdirSync(depDir, { recursive: true });
  const livePath = resolve(depDir, 'mainnet-dglotus.json');
  if (existsSync(livePath)) {
    const archive = resolve(depDir, `mainnet-dglotus-archived-${Date.now()}.json`);
    renameSync(livePath, archive);
    console.log('Archived', archive);
  }

  const record = {
    tier: 'glotus',
    ticker,
    name: GLOTUS_TOKEN_NAME,
    tokenId: genesis.tokenId,
    mode: 'glotus-moore-felt-bit',
    role: 'incubation-glotus',
    covenant: 'GlotusPowRemintMooreTip',
    decimals: 0,
    powAddress: contract.address,
    redeemScriptHex: contract.redeemHex,
    codeHashHex: toHex(contract.codeHash),
    codeBytesHex: toHex(contract.codeBytes),
    prefixHashHex: toHex(contract.prefixHash),
    tipValueOffset: contract.tipValueOffset,
    genesisUnix,
    baseZeroBits: BASE_ZERO_BITS,
    secondsPerExtraBit: SECONDS_PER_EXTRA_BIT,
    daysPerBit: GLOTUS_MOORE_DAYS_PER_EXTRA_BIT,
    tipLocktime,
    mintAtomsPerRemint: GLOTUS_MINT_ATOMS.toString(),
    initialMintAtoms: GLOTUS_MINT_ATOMS.toString(),
    mintSplit: { miner: GLOTUS_MINT_ATOMS.toString(), temple: '0' },
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
    cashtab: `https://cashtab.com/#/token/${genesis.tokenId}`,
    notes: [
      'Felt +1 bit (Moore 2× / 845 days). Hard next-P2SH. No temple tax.',
      'ALP MINT only (no DANA EMPP tip) so remBits fits in 201 ops.',
      `ALP max ${POW_BATON_COUNT} batons (immutable). Prior 4-baton dGLOTUS is leftover.`,
      'Dogfood ticker DGLOTUS — production GLOTUS is a later genesis.',
    ],
  };

  writeFileSync(livePath, `${JSON.stringify(record, null, 2)}\n`);
  console.log('\ndGLOTUS ready');
  console.log(JSON.stringify(record, null, 2));
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
