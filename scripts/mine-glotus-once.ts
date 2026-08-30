#!/usr/bin/env tsx
/**
 * Mine one remint against deployments/mainnet-dglotus.json.
 *
 *   GLOTUS_MNEMONIC='…' npm run mine-glotus-once
 */
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { payment, toHex } from 'ecash-lib';
import { createChronik } from '../src/network/createChronik.js';
import { getMedianTimePast } from '../src/network/medianTimePast.js';
import { createPowRemintGlotusTipContract } from '../src/covenant/powRemintGlotusTipScript.js';
import { expectedGlotusMintOpReturnScript } from '../src/covenant/powRemintGlotusTipOutputs.js';
import { computeMooreTipState } from '../src/covenant/mooreTip.js';
import { buildMinedMooreTipRemintTx } from '../src/miner/remintMooreTip.js';
import { loadGlotusGenesisWallet } from './glotus-genesis-address.js';

const REMINT_FUEL_SATS = 4_000n;
const DEP_PATH = resolve(process.cwd(), 'deployments/mainnet-dglotus.json');

interface BatonTip {
  index: number;
  tipLocktime: number;
  powAddress: string;
  lastRemintTxid: string | null;
}

interface GlotusDep {
  tokenId: string;
  genesisUnix: number;
  baseZeroBits: number;
  secondsPerExtraBit: number;
  mintAtomsPerRemint: string;
  batonTips?: BatonTip[];
}

async function ensureFuel(
  wallet: Awaited<ReturnType<typeof loadGlotusGenesisWallet>>,
): Promise<void> {
  await wallet.sync();
  const sized = wallet.utxos.find(
    u =>
      !u.token &&
      u.sats >= REMINT_FUEL_SATS &&
      u.sats <= REMINT_FUEL_SATS + 1_000n,
  );
  if (sized) return;

  const big = wallet.utxos
    .filter(u => !u.token && u.sats > REMINT_FUEL_SATS + 2_000n)
    .sort((a, b) => (a.sats < b.sats ? 1 : -1))[0];
  if (!big) {
    const any = wallet.utxos.find(u => !u.token && u.sats >= REMINT_FUEL_SATS);
    if (any) return;
    throw new Error(
      `Need a pure XEC UTXO ≥ ${REMINT_FUEL_SATS} sats for remint fees`,
    );
  }

  console.log(
    `Splitting fuel: ${big.sats} → ${REMINT_FUEL_SATS} (no covenant change out)`,
  );
  const action: payment.Action = {
    outputs: [{ sats: REMINT_FUEL_SATS, script: wallet.script }],
  };
  const resp = await wallet.action(action).build().broadcast();
  if (!resp.success || !resp.broadcasted?.length) {
    throw new Error(`Fuel split failed: ${JSON.stringify(resp)}`);
  }
  console.log('Fuel split tx', resp.broadcasted[0]);
  await wallet.sync();
}

async function main(): Promise<void> {
  if (!existsSync(DEP_PATH)) {
    throw new Error('Missing deployments/mainnet-dglotus.json — create-glotus-token first');
  }
  const dep = JSON.parse(readFileSync(DEP_PATH, 'utf8')) as GlotusDep;
  const batonIndex = Number(process.env.BATON_INDEX?.trim() || 0);
  const mintAtoms = BigInt(dep.mintAtomsPerRemint);
  const tips =
    dep.batonTips && dep.batonTips.length > 0
      ? dep.batonTips
      : [
          {
            index: 0,
            tipLocktime: dep.genesisUnix,
            powAddress: '',
            lastRemintTxid: null,
          },
        ];
  const tipRec = tips.find(t => t.index === batonIndex) ?? tips[0]!;

  const chronik = await createChronik('closest');
  const wallet = await loadGlotusGenesisWallet(chronik);
  await ensureFuel(wallet);

  const contract = await createPowRemintGlotusTipContract({
    tokenId: dep.tokenId,
    mintAtoms,
    genesisUnix: dep.genesisUnix,
    baseZeroBits: dep.baseZeroBits,
    secondsPerExtraBit: dep.secondsPerExtraBit,
    tipLocktime: tipRec.tipLocktime,
  });
  if (tipRec.powAddress && tipRec.powAddress !== contract.address) {
    throw new Error(
      `Address mismatch: tip=${tipRec.powAddress} computed=${contract.address}`,
    );
  }

  const scriptHex = toHex(contract.scriptHash);
  const scriptUtxos = await chronik.script('p2sh', scriptHex).utxos();
  const list = Array.isArray(scriptUtxos)
    ? scriptUtxos
    : ((scriptUtxos as { utxos?: unknown[] }).utxos ?? []);
  const batonUtxos = (
    list as {
      token?: { tokenId?: string; isMintBaton?: boolean };
      outpoint: { txid: string; outIdx: number };
      sats: number | bigint;
    }[]
  ).filter(u => u.token?.tokenId === dep.tokenId && u.token?.isMintBaton);
  if (batonUtxos.length === 0) {
    throw new Error(`No PoW batons at ${contract.address}`);
  }
  const preferred = tipRec.lastRemintTxid
    ? batonUtxos.find(u => u.outpoint.txid === tipRec.lastRemintTxid)
    : undefined;
  const b = preferred ?? batonUtxos[0]!;
  const baton = {
    outpoint: { txid: b.outpoint.txid, outIdx: b.outpoint.outIdx },
    sats: BigInt(b.sats),
    txid: b.outpoint.txid,
    vout: b.outpoint.outIdx,
  };

  await wallet.sync();
  const fuelUtxo = wallet.utxos
    .filter(u => !u.token && u.sats >= REMINT_FUEL_SATS)
    .sort((a, c) => (a.sats < c.sats ? -1 : 1))[0];
  if (!fuelUtxo) throw new Error('No fuel UTXO');

  const { mtp, tipHeight, tipUnix } = await getMedianTimePast(chronik);
  const locktime = Number(
    process.env.MOORE_TIP_LOCKTIME?.trim() ||
      Math.max(tipRec.tipLocktime, mtp - 1),
  );
  if (locktime < tipRec.tipLocktime) {
    throw new Error(`locktime ${locktime} < tipLocktime ${tipRec.tipLocktime}`);
  }
  if (locktime >= mtp) {
    throw new Error(
      `locktime ${locktime} ≥ MTP ${mtp} (tip ${tipHeight} @ ${tipUnix})`,
    );
  }

  const nextContract = await createPowRemintGlotusTipContract({
    tokenId: dep.tokenId,
    mintAtoms,
    genesisUnix: dep.genesisUnix,
    baseZeroBits: dep.baseZeroBits,
    secondsPerExtraBit: dep.secondsPerExtraBit,
    tipLocktime: locktime,
  });
  const opReturn = expectedGlotusMintOpReturnScript(dep.tokenId, mintAtoms);
  const preview = computeMooreTipState(locktime, contract.params);
  console.log(
    JSON.stringify(
      {
        tokenId: dep.tokenId,
        powAddress: contract.address,
        baton: `${baton.txid}:${baton.vout}`,
        locktime,
        mtp,
        bits: preview.bits,
        extraBits: preview.extraBits,
      },
      null,
      2,
    ),
  );

  const built = await buildMinedMooreTipRemintTx({
    contract,
    baton,
    fuel: {
      outpoint: fuelUtxo.outpoint,
      sats: fuelUtxo.sats,
      outputScript: wallet.script,
    },
    miner: { sk: wallet.sk, pk: wallet.pk },
    locktime,
    opReturn,
    nextContract,
  });
  const broadcast = await chronik.broadcastTx(built.txHex);
  const txid =
    typeof broadcast === 'string'
      ? broadcast
      : (broadcast as { txid: string }).txid;

  const nextTips = tips.map(t =>
    t.index === tipRec.index
      ? {
          ...t,
          tipLocktime: built.tip.locktime,
          powAddress: built.nextContract.address,
          lastRemintTxid: txid,
        }
      : t,
  );
  const updated = {
    ...dep,
    tipLocktime: nextTips[0]?.tipLocktime ?? built.tip.locktime,
    powAddress: nextTips[0]?.powAddress ?? built.nextContract.address,
    redeemScriptHex: built.nextContract.redeemHex,
    codeHashHex: toHex(built.nextContract.codeHash),
    batonTips: nextTips,
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(DEP_PATH, `${JSON.stringify(updated, null, 2)}\n`);
  writeFileSync(
    resolve(process.cwd(), 'deployments/mainnet-last-glotus-remint.json'),
    `${JSON.stringify(
      {
        tokenId: dep.tokenId,
        txid,
        bits: built.tip.bits,
        extraBits: built.tip.extraBits,
        powAttempts: built.powAttempts,
        nextPowAddress: built.nextContract.address,
        explorer: `https://explorer.e.cash/tx/${txid}`,
        minedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        txid,
        bits: built.tip.bits,
        powAttempts: built.powAttempts,
        nextPowAddress: built.nextContract.address,
        explorer: `https://explorer.e.cash/tx/${txid}`,
      },
      null,
      2,
    ),
  );
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
