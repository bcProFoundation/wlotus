/**
 * Create a sized remint-fuel coin (~REMINT_FUEL_SATS).
 *
 * Remint has no change out, so fuel must stay ~REMINT_FUEL_SATS.
 *
 * Treasury stays on the **desk / tip-funding** address. Only the sized fuel
 * coin is sent to the tip receive address that signs remint. Change must
 * never land on the tip (or BIP44 change chain) — otherwise the next burn
 * cannot draw from funding and leftover drifts to …/1/i.
 *
 * Usage:
 *   - Desk → tip fuel: peelSizedFuel(desk, { fuelScript: tip.script, changeScript: desk.script })
 *   - Legacy tip-local split: peelSizedFuel(tip) still works, but prefer desk→tip.
 */
import type { Script } from 'ecash-lib';
import type { Wallet } from 'ecash-wallet';
import {
  REMINT_FUEL_SATS,
  pickSizedFuelUtxo,
  pickSplitSourceUtxo,
} from './fuelUtxo.js';

export type PeelSizedFuelOpts = {
  /** Where the ~40 XEC fuel UTXO is created (default: wallet.script). */
  fuelScript?: Script;
  /** Where leftover XEC returns (default: wallet.script). Use desk for treasury. */
  changeScript?: Script;
};

export async function peelSizedFuel(
  wallet: Wallet,
  opts: PeelSizedFuelOpts = {},
): Promise<string | null> {
  await wallet.sync();
  if (pickSizedFuelUtxo(wallet.utxos)) return null;
  const big = pickSplitSourceUtxo(wallet.utxos);
  if (!big) {
    throw new Error(
      `Need XEC ≥ ${Number(REMINT_FUEL_SATS) / 100} for a sized remint fee UTXO`,
    );
  }

  const fuelScript = opts.fuelScript ?? wallet.script;
  const changeScript = opts.changeScript ?? wallet.script;

  const { payment } = await import('ecash-lib');
  const action: payment.Action = {
    outputs: [{ sats: REMINT_FUEL_SATS, script: fuelScript }],
  };

  const previous = wallet.getChangeScript.bind(wallet);
  (wallet as { getChangeScript: () => Script }).getChangeScript = () =>
    changeScript;

  let resp: { success: boolean; broadcasted?: string[] };
  try {
    resp = await wallet.action(action).build().broadcast();
  } finally {
    (wallet as { getChangeScript: () => Script }).getChangeScript = previous;
  }

  if (!resp.success || !resp.broadcasted?.length) {
    throw new Error(`Fuel split failed: ${JSON.stringify(resp)}`);
  }
  await wallet.sync();
  return resp.broadcasted[0]!;
}

/**
 * Desk (tip-funding) → tip: create one sized fuel on tip; change stays on desk.
 */
export async function sendSizedFuelFromDesk(
  desk: Wallet,
  tip: Wallet,
): Promise<string> {
  await desk.sync();
  const big = pickSplitSourceUtxo(desk.utxos);
  // Also allow exact-sized send when desk has any pure UTXO ≥ fuel
  const pure = desk.utxos.filter(u => !u.token);
  const can = pure.some(u => u.sats >= REMINT_FUEL_SATS);
  if (!can && !big) {
    throw new Error(
      `Desk needs ≥ ${Number(REMINT_FUEL_SATS) / 100} pure XEC to fund tip fuel`,
    );
  }

  const { payment } = await import('ecash-lib');
  const action: payment.Action = {
    outputs: [{ sats: REMINT_FUEL_SATS, script: tip.script }],
  };

  const previous = desk.getChangeScript.bind(desk);
  (desk as { getChangeScript: () => Script }).getChangeScript = () =>
    desk.script;

  let resp: { success: boolean; broadcasted?: string[] };
  try {
    resp = await desk.action(action).build().broadcast();
  } finally {
    (desk as { getChangeScript: () => Script }).getChangeScript = previous;
  }

  if (!resp.success || !resp.broadcasted?.length) {
    throw new Error(`Desk→tip sized fuel failed: ${JSON.stringify(resp)}`);
  }
  await desk.sync();
  await tip.sync();
  return resp.broadcasted[0]!;
}
