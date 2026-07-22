#!/usr/bin/env tsx
/**
 * Genesis for wLotus (MooreTipTemple) — **same covenant for prod and dryrun**.
 *
 * Only the ALP **ticker** differs:
 *   # Live (default ticker WLOTUS)
 *   TEMPLE_ADDRESS=ecash:p… BATONS=28 npm run create-wlotus-token
 *   # or: npm run create-prod-token
 *
 *   # Test / dryrun
 *   TICKER=dWLOTUS TEMPLE_ADDRESS=ecash:p… BATONS=28 npm run create-wlotus-token
 *   # or: npm run create-dryrun-wlotus   (sets TICKER=dWLOTUS)
 *
 * Also accepts CLI: `--ticker dWLOTUS`
 *
 * Immutable params (identical for every ticker):
 *   mint 108 (1+107), initialMintAtoms 108, baseZeroBits 0,
 *   Moore +1 bit / 500 days (override MOORE_DAYS_PER_EXTRA_BIT=365..730),
 *   hard next-P2SH + tipLocktime, bits cap 128.
 *
 * Ticker **WLOTUS** requires TEMPLE_ADDRESS (real P2SH). Other tickers may omit it
 * and P2SH-wrap the genesis P2PKH for convenience.
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
  Address,
  ALP_TOKEN_TYPE_STANDARD,
  DEFAULT_DUST_SATS,
  fromHex,
  payment,
  Script,
  shaRmd160,
  toHex,
} from 'ecash-lib';
import { createChronik } from '../src/network/createChronik.js';
import { getMedianTimePast } from '../src/network/medianTimePast.js';
import { broadcastAlpGenesis } from '../src/genesis/broadcastGenesis.js';
import { createPowRemintMooreTipTempleContract } from '../src/covenant/powRemintMooreTipTempleScript.js';
import {
  WLOTUS_MINT_ATOMS,
  WLOTUS_MINER_ATOMS,
  WLOTUS_TEMPLE_ATOMS,
} from '../src/params/wlotusMint.js';
import { resolveProdSecondsPerExtraBit } from '../src/covenant/mooreTip.js';
import {
  POW_BATON_COUNT,
  PROD_TOKEN_NAME,
  PROD_TOKEN_TICKER,
  TOKEN_URL,
} from '../src/params/consensus.js';

loadEnv({ path: resolve(process.cwd(), '.env') });

/** Baked into new genesis only — existing deployments keep their JSON value. */
const SECONDS_PER_EXTRA_BIT = resolveProdSecondsPerExtraBit(
  process.env.MOORE_DAYS_PER_EXTRA_BIT,
);

/** Whole-byte launch base — max headroom to 128-bit sunset. */
const BASE_ZERO_BITS = 0;

function resolveTicker(): string {
  const argv = process.argv.slice(2);
  let fromCli: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--ticker=')) {
      fromCli = a.slice('--ticker='.length);
      break;
    }
    if (a === '--ticker' && argv[i + 1]) {
      fromCli = argv[i + 1];
      break;
    }
  }
  const raw = (process.env.TICKER?.trim() || fromCli || PROD_TOKEN_TICKER).trim();
  if (!/^[A-Za-z][A-Za-z0-9]{0,15}$/.test(raw)) {
    throw new Error(
      `Invalid TICKER=${JSON.stringify(raw)}; use e.g. WLOTUS or dWLOTUS`,
    );
  }
  return raw.toUpperCase();
}

function resolveTempleScriptHash(
  wallet: Wallet,
  requireRealTemple: boolean,
): {
  scriptHash: Uint8Array;
  address: string;
  dryrunWrappedP2pkh: boolean;
  templeRedeemHex: string | null;
} {
  const raw = process.env.TEMPLE_ADDRESS?.trim();
  if (raw) {
    const addr = Address.parse(raw);
    if (addr.type !== 'p2sh') {
      throw new Error(
        `TEMPLE_ADDRESS must be P2SH (got ${addr.type}); IFP-style temple sink`,
      );
    }
    const hashHex =
      typeof addr.hash === 'string' ? addr.hash : toHex(addr.hash);
    return {
      scriptHash: fromHex(hashHex),
      address: addr.toString(),
      dryrunWrappedP2pkh: false,
      templeRedeemHex: null,
    };
  }
  if (requireRealTemple) {
    throw new Error(
      `Ticker ${PROD_TOKEN_TICKER} requires TEMPLE_ADDRESS=ecash:p… (real P2SH temple; no wrap)`,
    );
  }
  // Dryrun convenience: P2SH-wrap genesis P2PKH (same key spends via redeem reveal).
  const p2pkh = Script.p2pkh(shaRmd160(wallet.pk));
  const scriptHash = shaRmd160(p2pkh.bytecode);
  return {
    scriptHash,
    address: Address.p2sh(scriptHash, 'ecash').toString(),
    dryrunWrappedP2pkh: true,
    templeRedeemHex: toHex(p2pkh.bytecode),
  };
}

/** Deployment JSON stem — prod vs test paths for mint-api. */
function deploymentStem(ticker: string): {
  fileStem: string;
  role: 'production' | 'production-dryrun';
  isProdTicker: boolean;
} {
  const isProdTicker = ticker === PROD_TOKEN_TICKER;
  return {
    isProdTicker,
    role: isProdTicker ? 'production' : 'production-dryrun',
    fileStem: isProdTicker ? 'mainnet-wlotus' : 'mainnet-dryrun-wlotus',
  };
}

async function main(): Promise<void> {
  const ticker = resolveTicker();
  const { fileStem, role, isProdTicker } = deploymentStem(ticker);
  const batons = Number(process.env.BATONS?.trim() || POW_BATON_COUNT);
  if (!Number.isFinite(batons) || batons < 2) {
    throw new Error(`BATONS must be >= 2 (got ${batons})`);
  }
  if (batons > POW_BATON_COUNT) {
    throw new Error(
      `BATONS=${batons} exceeds ALP max ${POW_BATON_COUNT} (immutable at genesis)`,
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

  const wallet = Wallet.fromSk(fromHex(skHex), chronik);
  await wallet.sync();
  const temple = resolveTempleScriptHash(wallet, isProdTicker);

  console.log(
    JSON.stringify(
      {
        address: wallet.address,
        balanceXec: Number(wallet.balanceSats) / 100,
        ticker,
        name: PROD_TOKEN_NAME,
        baseZeroBits: BASE_ZERO_BITS,
        mintAtoms: Number(WLOTUS_MINT_ATOMS),
        initialMintAtoms: Number(WLOTUS_MINT_ATOMS),
        templeAddress: temple.address,
        secondsPerExtraBit: SECONDS_PER_EXTRA_BIT,
        genesisUnix,
        tipLocktime,
        batons,
        tipHeight,
        mtp,
        role,
        regime: 'moore-tip-temple',
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
    ticker,
    name: PROD_TOKEN_NAME,
    url: TOKEN_URL,
    decimals: 0,
    initialMintAtoms: WLOTUS_MINT_ATOMS,
    powBatonCount: batons,
  });
  console.log('Genesis', genesis.tokenId);

  const contract = await createPowRemintMooreTipTempleContract({
    tokenId: genesis.tokenId,
    mintAtoms: WLOTUS_MINT_ATOMS,
    templeScriptHash: temple.scriptHash,
    genesisUnix,
    baseZeroBits: BASE_ZERO_BITS,
    secondsPerExtraBit: SECONDS_PER_EXTRA_BIT,
    tipLocktime,
  });
  console.log('MooreTipTemple address', contract.address);
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
  const livePath = resolve(depDir, `${fileStem}.json`);
  if (existsSync(livePath)) {
    const archive = resolve(
      depDir,
      `${fileStem}-archived-${Date.now()}.json`,
    );
    renameSync(livePath, archive);
    console.log('Archived', archive);
  }

  const record = {
    tier: 'wlotus',
    ticker,
    name: PROD_TOKEN_NAME,
    tokenId: genesis.tokenId,
    mode: 'moore-tip-temple-hard-bind',
    role,
    covenant: 'WlotusPowRemintMooreTipTemple',
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
    tipLocktime,
    mintAtomsPerRemint: WLOTUS_MINT_ATOMS.toString(),
    initialMintAtoms: WLOTUS_MINT_ATOMS.toString(),
    mintSplit: {
      miner: WLOTUS_MINER_ATOMS.toString(),
      temple: WLOTUS_TEMPLE_ATOMS.toString(),
    },
    templeAddress: temple.address,
    templeScriptHashHex: toHex(temple.scriptHash),
    templeRedeemHex: temple.templeRedeemHex,
    templeDryrunWrappedP2pkh: temple.dryrunWrappedP2pkh,
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
      'Moore D: +1 bit / 500 days (五百罗汉; override MOORE_DAYS_PER_EXTRA_BIT=365..730). Cap bits ≤ 128. Whole-byte PoW only. baseZeroBits=0.',
      `wLotus: mint ${WLOTUS_MINT_ATOMS} (one mala) → ${WLOTUS_MINER_ATOMS} miner + ${WLOTUS_TEMPLE_ATOMS} temple P2SH. initialMintAtoms=${WLOTUS_MINT_ATOMS}. Remint tip + burn memorial use DANA LOKAD.`,
      isProdTicker
        ? `Prod genesis ticker ${PROD_TOKEN_TICKER} — do not reuse test secrets or mnemonics.`
        : `Test/dryrun genesis ticker ${ticker} — same covenant as prod; only ticker/metadata differ.`,
    ],
  };

  writeFileSync(livePath, `${JSON.stringify(record, null, 2)}\n`);
  if (!isProdTicker) {
    writeFileSync(
      resolve(depDir, 'mainnet-dryrun-active.json'),
      `${JSON.stringify(record, null, 2)}\n`,
    );
  }
  console.log(isProdTicker ? '\nLive WLOTUS ready' : `\n${ticker} dryrun ready`);
  console.log(JSON.stringify(record, null, 2));
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
