/**
 * Create a sized remint-fuel coin (~REMINT_FUEL_SATS).
 *
 * Remint has no change out, so fuel must stay ~REMINT_FUEL_SATS.
 *
 * Offering path: desk sends one sized coin to the mint/tip receive address;
 * leftover XEC stays on the desk. Do not sweep mint leftover back to desk
 * during an offering (that swallows the next fuel).
 *
 *   sendSizedFuelFromDesk(desk, tip) — normal offering fund
 *   peelSizedFuel(tip, { changeScript: tip.script }) — only if desk is empty
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
 * Desk (tip-funding) → tip: **only** ~40 XEC fuel lands on tip.
 * Change is forced onto desk.script (never tip, never BIP44 change chain).
 *
 * Old bug: `toHex(script)` was called on Script objects (not Uint8Array),
 * so both hex strings were empty and this threw even when desk ≠ mint.
 */
export async function sendSizedFuelFromDesk(
  desk: Wallet,
  tip: Wallet,
): Promise<string> {
  await desk.sync();
  const pure = desk.utxos.filter(u => !u.token);
  const can = pure.some(u => u.sats >= REMINT_FUEL_SATS);
  if (!can) {
    throw new Error(
      `Desk needs ≥ ${Number(REMINT_FUEL_SATS) / 100} pure XEC to fund tip fuel`,
    );
  }

  if (desk.address === tip.address) {
    throw new Error(
      `Desk and mint/tip addresses are identical (${desk.address}) — ` +
        `cannot route fuel vs change. Tip HD account must be m/44'/1899'/(tipIndex+1)'.`,
    );
  }

  const { payment } = await import('ecash-lib');
  const action: payment.Action = {
    // Exactly one payment output: sized fuel → tip. Change via getChangeScript.
    outputs: [{ sats: REMINT_FUEL_SATS, script: tip.script }],
  };

  const deskScript = desk.script;
  const previous = desk.getChangeScript.bind(desk);
  (desk as { getChangeScript: () => Script }).getChangeScript = () =>
    deskScript;

  try {
    const built = desk.action(action).build();
    const resp = await built.broadcast();
    if (!resp.success || !resp.broadcasted?.length) {
      throw new Error(`Desk→tip sized fuel failed: ${JSON.stringify(resp)}`);
    }
    await desk.sync();
    await tip.sync();
    return resp.broadcasted[0]!;
  } finally {
    (desk as { getChangeScript: () => Script }).getChangeScript = previous;
  }
}
