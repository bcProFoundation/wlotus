#!/usr/bin/env tsx
/**
 * Genesis for MooreTip tiers: Prayer | Candle | Flower | wLotus.
 *
 * Test / dryrun (ticker prefixed with `d`):
 *   TIER=prayer npm run create-dryrun-token
 *   TIER=wlotus BATONS=28 TEMPLE_ADDRESS=ecash:p… npm run create-dryrun-token
 *
 * Live production WLOTUS (no `d` prefix) — Contabo prod only:
 *   LIVE=1 TIER=wlotus BATONS=28 TEMPLE_ADDRESS=ecash:p… npm run create-prod-token
 *   → deployments/mainnet-wlotus.json
 *
 * wLotus: mint 108 (one mala) → 1 miner + 107 temple **P2SH** (MooreTipTemple).
 * LIVE=1 requires TEMPLE_ADDRESS (real IFP-style P2SH). Dryrun may omit it and
 * wrap the genesis P2PKH in P2SH for convenience.
 * Moore clock: +1 bit / 500 days by default (五百罗汉; override `MOORE_DAYS_PER_EXTRA_BIT=365..730`).
 * Hard next-P2SH + tipLocktime.
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
import { createPowRemintMooreTipMemoContract } from '../src/covenant/powRemintMooreTipMemoScript.js';
import { createPowRemintMooreTipTempleContract } from '../src/covenant/powRemintMooreTipTempleScript.js';
import {
  WLOTUS_MINT_ATOMS,
  WLOTUS_MINER_ATOMS,
  WLOTUS_TEMPLE_ATOMS,
} from '../src/params/wlotusMint.js';
import { resolveProdSecondsPerExtraBit } from '../src/covenant/mooreTip.js';
import {
  CANDLE_MINT_ATOMS,
  CANDLE_NAME,
  CANDLE_TICKER,
  FLOWER_MINT_ATOMS,
  FLOWER_NAME,
  FLOWER_TICKER,
  POW_BATON_COUNT,
  PROD_TOKEN_NAME,
  PROD_TOKEN_TICKER,
  PRAYER_MINT_ATOMS,
  PRAYER_NAME,
  PRAYER_TICKER,
  TOKEN_URL,
} from '../src/params/consensus.js';

loadEnv({ path: resolve(process.cwd(), '.env') });

const LIVE = /^(1|true|yes)$/i.test(process.env.LIVE?.trim() || '');
/** Baked into new genesis only — existing deployments keep their JSON value. */
const SECONDS_PER_EXTRA_BIT = resolveProdSecondsPerExtraBit(
  process.env.MOORE_DAYS_PER_EXTRA_BIT,
);

type Tier = 'prayer' | 'candle' | 'flower' | 'wlotus';

const TIERS: Record<
  Tier,
  { ticker: string; name: string; bits: number; mint: bigint; batons: number }
> = {
  // Whole-byte PoW bases (bits % 8 == 0) required by MooreTip op budget.
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
  wlotus: {
    // LIVE=1 → ticker WLOTUS; otherwise dryrun dWLOTUS
    // Base **0**: max headroom to 128 (~+33y vs base 24). Presence = soft pray +
    // 1/107 + fees; PoW is tip fairness later, not a launch gate.
    ticker: LIVE ? PROD_TOKEN_TICKER : `d${PROD_TOKEN_TICKER}`,
    name: PROD_TOKEN_NAME,
    bits: 0,
    mint: WLOTUS_MINT_ATOMS,
    batons: POW_BATON_COUNT,
  },
};

function resolveTempleScriptHash(wallet: Wallet): {
  scriptHash: Uint8Array;
  address: string;
  /** True when dryrun wrapped genesis P2PKH inside P2SH. */
  dryrunWrappedP2pkh: boolean;
  /** Redeem hex when dryrunWrappedP2pkh (spend by revealing this). */
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
  // Dryrun default: P2SH-wrap genesis P2PKH (same key spends via redeem reveal).
  const p2pkh = Script.p2pkh(shaRmd160(wallet.pk));
  const scriptHash = shaRmd160(p2pkh.bytecode);
  return {
    scriptHash,
    address: Address.p2sh(scriptHash, 'ecash').toString(),
    dryrunWrappedP2pkh: true,
    templeRedeemHex: toHex(p2pkh.bytecode),
  };
}

async function main(): Promise<void> {
  const tierName = (process.env.TIER?.trim().toLowerCase() || 'prayer') as Tier;
  const tier = TIERS[tierName];
  if (!tier) {
    throw new Error(
      `Unknown TIER=${tierName}; use prayer|candle|flower|wlotus`,
    );
  }
  if (LIVE && tierName !== 'wlotus') {
    throw new Error('LIVE=1 is only supported for TIER=wlotus (live WLOTUS)');
  }
  if (LIVE && !process.env.TEMPLE_ADDRESS?.trim()) {
    throw new Error(
      'LIVE=1 requires TEMPLE_ADDRESS=ecash:p… (real P2SH temple; no dryrun wrap)',
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
  const temple =
    tierName === 'wlotus' ? resolveTempleScriptHash(wallet) : null;

  console.log(
    JSON.stringify(
      {
        address: wallet.address,
        balanceXec: Number(wallet.balanceSats) / 100,
        live: LIVE,
        tier: tierName,
        ticker: tier.ticker,
        baseZeroBits: tier.bits,
        mintAtoms: Number(tier.mint),
        initialMintAtoms:
          tierName === 'wlotus' ? Number(WLOTUS_MINT_ATOMS) : 1000,
        templeAddress: temple?.address ?? null,
        secondsPerExtraBit: SECONDS_PER_EXTRA_BIT,
        genesisUnix,
        tipLocktime,
        batons,
        tipHeight,
        mtp,
        regime:
          tierName === 'wlotus'
            ? LIVE
              ? 'production-moore-tip-temple'
              : 'production-moore-tip-temple-dryrun'
            : 'production-moore-tip-dryrun',
      },
      null,
      2,
    ),
  );

  // Genesis + N handoffs (dust baton each) + fees. ~3k sats/handoff is conservative.
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
    // wLotus: exactly one mala (108) as genesis fungible supply — same as remint size.
    // Other dryrun tiers keep a small desk float for smoke tests.
    initialMintAtoms: tierName === 'wlotus' ? WLOTUS_MINT_ATOMS : 1_000n,
    powBatonCount: batons,
  });
  console.log('Genesis', genesis.tokenId);

  const contract =
    tierName === 'wlotus'
      ? await createPowRemintMooreTipTempleContract({
          tokenId: genesis.tokenId,
          mintAtoms: tier.mint,
          templeScriptHash: temple!.scriptHash,
          genesisUnix,
          baseZeroBits: tier.bits,
          secondsPerExtraBit: SECONDS_PER_EXTRA_BIT,
          tipLocktime,
        })
      : tierName === 'prayer'
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
    tierName === 'wlotus'
      ? 'MooreTipTemple address'
      : tierName === 'prayer'
        ? 'MooreTipMemo address'
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
  const fileStem = LIVE ? `mainnet-${tierName}` : `mainnet-dryrun-${tierName}`;
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
    tierName === 'wlotus'
      ? 'WlotusPowRemintMooreTipTemple'
      : tierName === 'prayer'
        ? 'WlotusPowRemintMooreTipMemo'
        : 'WlotusPowRemintMooreTip';

  const record = {
    tier: tierName,
    ticker: tier.ticker,
    name: tier.name,
    tokenId: genesis.tokenId,
    mode:
      tierName === 'wlotus'
        ? 'moore-tip-temple-hard-bind'
        : tierName === 'prayer'
          ? 'moore-tip-memo-hard-bind'
          : 'moore-tip-hard-bind',
    role: LIVE ? 'production' : 'production-dryrun',
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
    initialMintAtoms:
      tierName === 'wlotus' ? WLOTUS_MINT_ATOMS.toString() : '1000',
    mintSplit:
      tierName === 'wlotus'
        ? {
            miner: WLOTUS_MINER_ATOMS.toString(),
            temple: WLOTUS_TEMPLE_ATOMS.toString(),
          }
        : null,
    templeAddress: temple?.address ?? null,
    templeScriptHashHex: temple ? toHex(temple.scriptHash) : null,
    templeRedeemHex: temple?.templeRedeemHex ?? null,
    templeDryrunWrappedP2pkh: temple?.dryrunWrappedP2pkh ?? null,
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
      'Moore D: +1 bit / 500 days (五百罗汉; override MOORE_DAYS_PER_EXTRA_BIT=365..730). Cap bits ≤ 128. Whole-byte PoW only.',
      tierName === 'wlotus'
        ? `wLotus: mint ${WLOTUS_MINT_ATOMS} (one mala) → ${WLOTUS_MINER_ATOMS} miner + ${WLOTUS_TEMPLE_ATOMS} temple P2SH (IFP-style). Temple spends are rare multisig/ops. No memorial EMPP (op budget). Remint tip + burn memorial use DANA LOKAD.`
        : tierName === 'prayer'
          ? 'Prayer memo mint: 1 atom/remint to desk; DANA memorial in mint OP_RETURN (no burn tx).'
          : 'Candle/Flower use MooreTip without memorial push.',
      LIVE
        ? 'LIVE genesis: ticker WLOTUS — do not copy test dWLOTUS secrets or mnemonics.'
        : 'Dryrun genesis: ticker prefixed with d (e.g. dWLOTUS).',
      'Ergon not used for production tiers.',
    ],
  };

  writeFileSync(livePath, `${JSON.stringify(record, null, 2)}\n`);
  if (!LIVE && (tierName === 'prayer' || tierName === 'wlotus')) {
    writeFileSync(
      resolve(depDir, 'mainnet-dryrun-active.json'),
      `${JSON.stringify(record, null, 2)}\n`,
    );
  }
  console.log(LIVE ? '\nLive WLOTUS ready' : '\nDryrun ready');
  console.log(JSON.stringify(record, null, 2));
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
