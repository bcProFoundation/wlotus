#!/usr/bin/env tsx
/**
 * Genesis for W Lotus — **same covenant for prod and dryrun**.
 *
 * Default: `GlotusPowRemintMooreTip` + ALP ticker WLOTUS / name "W Lotus".
 * 108 to miner, no temple ctor, felt +1 bit / 500 days, ALP MINT only.
 * Premine lands on the genesis wallet. Temple address is not required.
 *
 *   # Live (default ticker WLOTUS)
 *   BATONS=28 npm run create-wlotus-token
 *   # or: npm run create-prod-token / npm run create-felt-wlotus
 *
 *   # Test / dryrun
 *   TICKER=dWLOTUS BATONS=28 npm run create-wlotus-token
 *
 * Whole-byte WLotus MooreTip (256× / ~11 y):
 *   COVENANT=moore-tip BATONS=28 npm run create-wlotus-token
 *
 * Legacy 102/6 temple:
 *   FELT=0 TEMPLE_ADDRESS=ecash:p… BATONS=28 npm run create-wlotus-token
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
import { createPowRemintMooreTipContract } from '../src/covenant/powRemintMooreTipScript.js';
import { createPowRemintMooreTipTempleContract } from '../src/covenant/powRemintMooreTipTempleScript.js';
import { createPowRemintGlotusTipContract } from '../src/covenant/powRemintGlotusTipScript.js';
import {
  WLOTUS_FELT_COVENANT,
  WLOTUS_FELT_MODE,
  WLOTUS_MINT_ATOMS,
  WLOTUS_MINER_ATOMS,
  WLOTUS_MOORE_TIP_COVENANT,
  WLOTUS_MOORE_TIP_MODE,
  WLOTUS_TEMPLE_ATOMS,
  resolveWlotusGenesisRegime,
} from '../src/params/wlotusMint.js';
import {
  resolveFeltSecondsPerExtraBit,
  resolveProdSecondsPerExtraBit,
} from '../src/covenant/mooreTip.js';
import {
  POW_BATON_COUNT,
  PROD_TOKEN_NAME,
  PROD_TOKEN_TICKER,
  TOKEN_URL,
} from '../src/params/consensus.js';

loadEnv({ path: resolve(process.cwd(), '.env') });

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
  const regime = resolveWlotusGenesisRegime();
  const felt = regime === 'felt';
  const templeCovenant = regime === 'temple';
  const secondsPerExtraBit = felt
    ? resolveFeltSecondsPerExtraBit(process.env.MOORE_DAYS_PER_EXTRA_BIT)
    : resolveProdSecondsPerExtraBit(process.env.MOORE_DAYS_PER_EXTRA_BIT);
  const daysPerBit = secondsPerExtraBit / 86_400;
  const minerAtoms = templeCovenant ? WLOTUS_MINER_ATOMS : WLOTUS_MINT_ATOMS;
  const templeAtoms = templeCovenant ? WLOTUS_TEMPLE_ATOMS : 0n;
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
  const temple = templeCovenant
    ? resolveTempleScriptHash(wallet, isProdTicker)
    : null;
  const initialMintAddress = temple?.address ?? wallet.address;

  console.log(
    JSON.stringify(
      {
        address: wallet.address,
        balanceXec: Number(wallet.balanceSats) / 100,
        ticker,
        name: PROD_TOKEN_NAME,
        covenant: felt
          ? WLOTUS_FELT_COVENANT
          : templeCovenant
            ? 'WlotusPowRemintMooreTipTemple'
            : WLOTUS_MOORE_TIP_COVENANT,
        baseZeroBits: BASE_ZERO_BITS,
        mintAtoms: Number(WLOTUS_MINT_ATOMS),
        initialMintAtoms: Number(WLOTUS_MINT_ATOMS),
        initialMintTo: initialMintAddress,
        templeAddress: temple?.address ?? null,
        secondsPerExtraBit,
        daysPerBit,
        genesisUnix,
        tipLocktime,
        batons,
        tipHeight,
        mtp,
        role,
        regime,
        mintSplit: { miner: minerAtoms.toString(), temple: templeAtoms.toString() },
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
    ...(temple
      ? { initialMintScript: Script.p2sh(temple.scriptHash) }
      : {}),
  });
  console.log('Genesis', genesis.tokenId);
  console.log('Initial mint →', initialMintAddress);

  const contract = felt
    ? await createPowRemintGlotusTipContract({
        tokenId: genesis.tokenId,
        mintAtoms: WLOTUS_MINT_ATOMS,
        genesisUnix,
        baseZeroBits: BASE_ZERO_BITS,
        secondsPerExtraBit,
        tipLocktime,
      })
    : templeCovenant
      ? await createPowRemintMooreTipTempleContract({
          tokenId: genesis.tokenId,
          mintAtoms: WLOTUS_MINT_ATOMS,
          templeScriptHash: temple!.scriptHash,
          genesisUnix,
          baseZeroBits: BASE_ZERO_BITS,
          secondsPerExtraBit,
          tipLocktime,
        })
      : await createPowRemintMooreTipContract({
          tokenId: genesis.tokenId,
          mintAtoms: WLOTUS_MINT_ATOMS,
          genesisUnix,
          baseZeroBits: BASE_ZERO_BITS,
          secondsPerExtraBit,
          tipLocktime,
        });
  console.log(
    felt
      ? 'MooreTipFelt address'
      : templeCovenant
        ? 'MooreTipTemple address'
        : 'MooreTip address',
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
    mode: felt
      ? WLOTUS_FELT_MODE
      : templeCovenant
        ? 'moore-tip-temple-hard-bind'
        : WLOTUS_MOORE_TIP_MODE,
    role,
    covenant: felt
      ? WLOTUS_FELT_COVENANT
      : templeCovenant
        ? 'WlotusPowRemintMooreTipTemple'
        : WLOTUS_MOORE_TIP_COVENANT,
    decimals: 0,
    powAddress: contract.address,
    redeemScriptHex: contract.redeemHex,
    codeHashHex: toHex(contract.codeHash),
    codeBytesHex: toHex(contract.codeBytes),
    prefixHashHex: toHex(contract.prefixHash),
    tipValueOffset: contract.tipValueOffset,
    genesisUnix,
    baseZeroBits: BASE_ZERO_BITS,
    secondsPerExtraBit,
    daysPerBit,
    tipLocktime,
    mintAtomsPerRemint: WLOTUS_MINT_ATOMS.toString(),
    initialMintAtoms: WLOTUS_MINT_ATOMS.toString(),
    initialMintAddress,
    mintSplit: {
      miner: minerAtoms.toString(),
      temple: templeAtoms.toString(),
    },
    templeAddress: temple?.address ?? null,
    templeScriptHashHex: temple ? toHex(temple.scriptHash) : null,
    templeRedeemHex: temple?.templeRedeemHex ?? null,
    templeDryrunWrappedP2pkh: temple?.dryrunWrappedP2pkh ?? false,
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
    notes: felt
      ? [
          'Hard next-P2SH via codeHash + tipLocktime anti-rewind.',
          `Felt +1 bit / ${daysPerBit} days (2× / ~1.4 y from bits=0). Cap bits ≤ 128. ALP MINT only (no remint DANA tip). baseZeroBits=0.`,
          `W Lotus on GLotus felt redeem: mint ${WLOTUS_MINT_ATOMS} → miner only (no temple tax). initialMintAtoms=${WLOTUS_MINT_ATOMS} → ${initialMintAddress}.`,
          isProdTicker
            ? `Prod genesis ticker ${PROD_TOKEN_TICKER} — do not reuse test secrets or mnemonics.`
            : `Test/dryrun genesis ticker ${ticker} — same covenant as prod; only ticker/metadata differ.`,
        ]
      : templeCovenant
        ? [
            'Hard next-P2SH via codeHash + tipLocktime anti-rewind.',
            'Moore D: +1 bit / 500 days (五百罗汉; override MOORE_DAYS_PER_EXTRA_BIT=365..730). Cap bits ≤ 128. Whole-byte PoW only. baseZeroBits=0.',
            `W Lotus: mint ${WLOTUS_MINT_ATOMS} (one mala) → ${WLOTUS_MINER_ATOMS} miner + ${WLOTUS_TEMPLE_ATOMS} temple P2SH. initialMintAtoms=${WLOTUS_MINT_ATOMS} → temple. Remint tip + burn memorial use DANA LOKAD.`,
            isProdTicker
              ? `Prod genesis ticker ${PROD_TOKEN_TICKER} — do not reuse test secrets or mnemonics.`
              : `Test/dryrun genesis ticker ${ticker} — same covenant as prod; only ticker/metadata differ.`,
          ]
        : [
            'Hard next-P2SH via codeHash + tipLocktime anti-rewind.',
            'Moore D: +1 bit / 500 days (五百罗汉; override MOORE_DAYS_PER_EXTRA_BIT=365..730). Cap bits ≤ 128. Whole-byte PoW only. baseZeroBits=0.',
            `W Lotus: mint ${WLOTUS_MINT_ATOMS} → miner only (no temple ctor / tax). initialMintAtoms=${WLOTUS_MINT_ATOMS} → genesis wallet. Remint tip + burn memorial use DANA LOKAD.`,
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
