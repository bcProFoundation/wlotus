/**
 * Create sized remint-fuel / burn-postage coins.
 *
 * Remint has no change out, so fuel must stay ~REMINT_FUEL_SATS.
 * Burn postage is a second sized coin on the same desk→tip peel; leftover
 * XEC from the burn returns to the desk (not the tip).
 *
 *   sendOfferingPairFromDesk(desk, tip) — normal offering fund (one tx)
 *   peelSizedFuel(tip, { changeScript: desk.script }) — reclaim oversized
 *   peelOfferingPair(tip, { changeScript }) — only if desk is empty
 */
import { payment, type Script } from 'ecash-lib';
import type { Wallet } from 'ecash-wallet';
import {
  BURN_POSTAGE_SATS,
  OFFERING_PAIR_SATS,
  REMINT_FUEL_SATS,
  pickBurnPostageUtxo,
  pickSizedFuelUtxo,
  pickSplitSourceUtxo,
} from './fuelUtxo.js';

export type PeelSizedFuelOpts = {
  /** Where the sized output is created (default: wallet.script). */
  fuelScript?: Script;
  /** Where leftover XEC returns (default: wallet.script). Use desk for treasury. */
  changeScript?: Script;
  /** Output value (default: remint fuel). */
  sats?: bigint;
};

export type OfferingPairCoin = {
  txid: string;
  outIdx: number;
  sats: string;
};

export type OfferingPair = {
  txid: string;
  fuel: OfferingPairCoin;
  postage: OfferingPairCoin;
};

async function withChangeScript<T>(
  wallet: Wallet,
  changeScript: Script,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = wallet.getChangeScript.bind(wallet);
  (wallet as { getChangeScript: () => Script }).getChangeScript = () =>
    changeScript;
  try {
    return await fn();
  } finally {
    (wallet as { getChangeScript: () => Script }).getChangeScript = previous;
  }
}

/**
 * Split one sized coin from `wallet`. Used to reclaim an oversized tip
 * reserve onto the desk (fuel stays on tip, change → desk).
 */
export async function peelSizedFuel(
  wallet: Wallet,
  opts: PeelSizedFuelOpts = {},
): Promise<string | null> {
  const sats = opts.sats ?? REMINT_FUEL_SATS;
  await wallet.sync();
  if (sats === REMINT_FUEL_SATS && pickSizedFuelUtxo(wallet.utxos)) {
    return null;
  }
  if (sats === BURN_POSTAGE_SATS && pickBurnPostageUtxo(wallet.utxos)) {
    return null;
  }
  const splitMin = sats + 2_000n;
  const big = wallet.utxos
    .filter(u => !u.token && u.sats >= splitMin)
    .sort((a, b) => (a.sats < b.sats ? 1 : a.sats > b.sats ? -1 : 0))[0];
  if (!big) {
    throw new Error(
      `Need XEC ≥ ${Number(sats) / 100} for a sized fee UTXO`,
    );
  }

  const fuelScript = opts.fuelScript ?? wallet.script;
  const changeScript = opts.changeScript ?? wallet.script;

  const action: payment.Action = {
    outputs: [{ sats, script: fuelScript }],
  };

  const resp = await withChangeScript(wallet, changeScript, () =>
    wallet.action(action).build().broadcast(),
  );

  if (!resp.success || !resp.broadcasted?.length) {
    throw new Error(`Fuel split failed: ${JSON.stringify(resp)}`);
  }
  await wallet.sync();
  return resp.broadcasted[0]!;
}

function coinFromTip(
  tip: Wallet,
  txid: string,
  sats: bigint,
  label: string,
): OfferingPairCoin {
  const u = tip.utxos.find(
    x =>
      !x.token &&
      x.outpoint.txid === txid &&
      x.sats === sats,
  );
  if (!u) {
    throw new Error(
      `Desk→tip ${label} ${Number(sats) / 100} XEC not found on ${tip.address} after ${txid}`,
    );
  }
  return {
    txid: u.outpoint.txid,
    outIdx: u.outpoint.outIdx,
    sats: u.sats.toString(),
  };
}

/**
 * Desk → tip: remint fuel **and** burn postage in one transaction.
 * Change is forced onto desk.script (never tip, never BIP44 change chain).
 */
export async function sendOfferingPairFromDesk(
  desk: Wallet,
  tip: Wallet,
): Promise<OfferingPair> {
  await desk.sync();
  const pure = desk.utxos.filter(u => !u.token);
  const can = pure.some(u => u.sats >= OFFERING_PAIR_SATS + 2_000n)
    || pure.reduce((s, u) => s + u.sats, 0n) >= OFFERING_PAIR_SATS + 2_000n;
  if (!can) {
    throw new Error(
      `Desk needs ≥ ${Number(OFFERING_PAIR_SATS) / 100} pure XEC to fund tip remint+postage`,
    );
  }

  if (desk.address === tip.address) {
    throw new Error(
      `Desk and mint/tip addresses are identical (${desk.address}) — ` +
        `cannot route fuel vs change. Tip HD account must be m/44'/1899'/(tipIndex+1)'.`,
    );
  }

  const action: payment.Action = {
    outputs: [
      { sats: REMINT_FUEL_SATS, script: tip.script },
      { sats: BURN_POSTAGE_SATS, script: tip.script },
    ],
  };

  const txid = await withChangeScript(desk, desk.script, async () => {
    const built = desk.action(action).build();
    const resp = await built.broadcast();
    if (!resp.success || !resp.broadcasted?.length) {
      throw new Error(`Desk→tip offering pair failed: ${JSON.stringify(resp)}`);
    }
    return resp.broadcasted[0]!;
  });

  await desk.sync();
  await tip.sync();
  return {
    txid,
    fuel: coinFromTip(tip, txid, REMINT_FUEL_SATS, 'fuel'),
    postage: coinFromTip(tip, txid, BURN_POSTAGE_SATS, 'postage'),
  };
}

/** @deprecated alias — offering path now sends remint fuel + postage. */
export async function sendSizedFuelFromDesk(
  desk: Wallet,
  tip: Wallet,
): Promise<string> {
  const pair = await sendOfferingPairFromDesk(desk, tip);
  return pair.txid;
}

/**
 * Split remint fuel + postage from a local oversized coin (desk empty).
 * Change stays on `changeScript` (tip receive, or desk if reclaiming).
 */
export async function peelOfferingPair(
  wallet: Wallet,
  opts: PeelSizedFuelOpts = {},
): Promise<OfferingPair | null> {
  await wallet.sync();
  if (pickSizedFuelUtxo(wallet.utxos) && pickBurnPostageUtxo(wallet.utxos)) {
    return null;
  }
  const big = pickSplitSourceUtxo(wallet.utxos);
  if (!big) {
    throw new Error(
      `Need XEC ≥ ${Number(OFFERING_PAIR_SATS) / 100} for remint fuel + burn postage`,
    );
  }

  const fuelScript = opts.fuelScript ?? wallet.script;
  const changeScript = opts.changeScript ?? wallet.script;
  const action: payment.Action = {
    outputs: [
      { sats: REMINT_FUEL_SATS, script: fuelScript },
      { sats: BURN_POSTAGE_SATS, script: fuelScript },
    ],
  };

  const txid = await withChangeScript(wallet, changeScript, async () => {
    const resp = await wallet.action(action).build().broadcast();
    if (!resp.success || !resp.broadcasted?.length) {
      throw new Error(`Offering pair peel failed: ${JSON.stringify(resp)}`);
    }
    return resp.broadcasted[0]!;
  });

  await wallet.sync();
  return {
    txid,
    fuel: coinFromTip(wallet, txid, REMINT_FUEL_SATS, 'fuel'),
    postage: coinFromTip(wallet, txid, BURN_POSTAGE_SATS, 'postage'),
  };
}
