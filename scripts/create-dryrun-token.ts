#!/usr/bin/env tsx
/**
 * Dryrun genesis for production MooreTip tiers: Prayer | Candle | Flower | WLotus.
 *
 * Usage:
 *   TIER=prayer npm run create-dryrun-token
 *   TIER=candle npm run create-dryrun-token
 *   TIER=flower npm run create-dryrun-token
 *   TIER=wlotus npm run create-dryrun-token
 *   TIER=wlotus TEMPLE_ADDRESS=ecash:q… BATONS=2 npm run create-dryrun-token
 *
 * WLotus: mint 100 → 1 miner + 99 temple (MooreTipTemple covenant).
 * Uses hardened next-P2SH (codeHash) + tipLocktime. Moore clock: +1 bit / 840 days.
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
import { PROD_SECONDS_PER_EXTRA_BIT } from '../src/covenant/mooreTip.js';
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
    ticker: `d${PROD_TOKEN_TICKER}`,
    name: `${PROD_TOKEN_NAME} temple dryrun`,
    bits: 24,
    mint: WLOTUS_MINT_ATOMS,
    batons: POW_BATON_COUNT,
  },
};

function resolveTemplePkh(wallet: Wallet): {
  pkh: Uint8Array;
  address: string;
} {
  const raw = process.env.TEMPLE_ADDRESS?.trim();
  if (raw) {
    const addr = Address.parse(raw);
    if (addr.type !== 'p2pkh') {
      throw new Error(`TEMPLE_ADDRESS must be P2PKH (got ${addr.type})`);
    }
    const hashHex =
      typeof addr.hash === 'string' ? addr.hash : toHex(addr.hash);
    return { pkh: fromHex(hashHex), address: addr.toString() };
  }
  return {
    pkh: shaRmd160(wallet.pk),
    address: wallet.address,
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
  const temple = tierName === 'wlotus' ? resolveTemplePkh(wallet) : null;

  console.log(
    JSON.stringify(
      {
        address: wallet.address,
        balanceXec: Number(wallet.balanceSats) / 100,
        tier: tierName,
        ticker: tier.ticker,
        baseZeroBits: tier.bits,
        mintAtoms: Number(tier.mint),
        templeAddress: temple?.address ?? null,
        secondsPerExtraBit: PROD_SECONDS_PER_EXTRA_BIT,
        genesisUnix,
        tipLocktime,
        batons,
        tipHeight,
        mtp,
        regime:
          tierName === 'wlotus'
            ? 'production-moore-tip-temple-dryrun'
            : 'production-moore-tip-dryrun',
      },
      null,
      2,
    ),
  );

  if (wallet.balanceSats < 15_000n) {
    throw new Error(
      `Insufficient XEC: need ≥150, have ${Number(wallet.balanceSats) / 100}`,
    );
  }

  const genesis = await broadcastAlpGenesis(wallet, {
    ticker: tier.ticker,
    name: tier.name,
    url: TOKEN_URL,
    decimals: 0,
    initialMintAtoms: 1_000n,
    powBatonCount: batons,
  });
  console.log('Genesis', genesis.tokenId);

  const contract =
    tierName === 'wlotus'
      ? await createPowRemintMooreTipTempleContract({
          tokenId: genesis.tokenId,
          mintAtoms: tier.mint,
          templePkh: temple!.pkh,
          genesisUnix,
          baseZeroBits: tier.bits,
          secondsPerExtraBit: PROD_SECONDS_PER_EXTRA_BIT,
          tipLocktime,
        })
      : tierName === 'prayer'
        ? await createPowRemintMooreTipMemoContract({
            tokenId: genesis.tokenId,
            mintAtoms: tier.mint,
            genesisUnix,
            baseZeroBits: tier.bits,
            secondsPerExtraBit: PROD_SECONDS_PER_EXTRA_BIT,
            tipLocktime,
          })
        : await createPowRemintMooreTipContract({
            tokenId: genesis.tokenId,
            mintAtoms: tier.mint,
            genesisUnix,
            baseZeroBits: tier.bits,
            secondsPerExtraBit: PROD_SECONDS_PER_EXTRA_BIT,
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
  const livePath = resolve(depDir, `mainnet-dryrun-${tierName}.json`);
  if (existsSync(livePath)) {
    const archive = resolve(
      depDir,
      `mainnet-dryrun-${tierName}-archived-${Date.now()}.json`,
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
    role: 'production-dryrun',
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
    secondsPerExtraBit: PROD_SECONDS_PER_EXTRA_BIT,
    tipLocktime,
    mintAtomsPerRemint: tier.mint.toString(),
    mintSplit:
      tierName === 'wlotus'
        ? {
            miner: WLOTUS_MINER_ATOMS.toString(),
            temple: WLOTUS_TEMPLE_ATOMS.toString(),
          }
        : null,
    templeAddress: temple?.address ?? null,
    templePkhHex: temple ? toHex(temple.pkh) : null,
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
      'Moore D: production 840-day bit clock. Cap bits ≤ 128. Whole-byte PoW only.',
      tierName === 'wlotus'
        ? `WLotus: mint ${WLOTUS_MINT_ATOMS} → ${WLOTUS_MINER_ATOMS} miner + ${WLOTUS_TEMPLE_ATOMS} temple. Memorial EMPP not in this covenant (op budget).`
        : tierName === 'prayer'
          ? 'Prayer memo mint: 1 atom/remint to desk; WLBR memorial in mint OP_RETURN (no burn tx).'
          : 'Candle/Flower use MooreTip without memorial push.',
      'Ergon not used for production tiers.',
    ],
  };

  writeFileSync(livePath, `${JSON.stringify(record, null, 2)}\n`);
  if (tierName === 'prayer' || tierName === 'wlotus') {
    writeFileSync(
      resolve(depDir, 'mainnet-dryrun-active.json'),
      `${JSON.stringify(record, null, 2)}\n`,
    );
  }
  console.log('\nDryrun ready');
  console.log(JSON.stringify(record, null, 2));
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
