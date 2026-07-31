/**
 * Peel a sized remint-fuel coin while keeping leftover XEC on the tip
 * receive address.
 *
 * Remint has no change out, so fuel must stay ~REMINT_FUEL_SATS. The tip fee
 * wallet should still hold a large treasury and peel locally — otherwise every
 * offering pays an extra desk→tip network fee.
 *
 * ecash-wallet HD accounts put automatic change on the BIP44 change chain
 * (…/1/i). On our tip fee wallets that leftover was landing on the desk
 * address instead of staying spendable on the tip receive script, so the tip
 * was drained back to ~40 XEC after every large top-up. Force change onto
 * `wallet.script` (the tip receive address remint actually spends).
 */
import type { Script } from 'ecash-lib';
import type { Wallet } from 'ecash-wallet';
import {
  REMINT_FUEL_SATS,
  pickSizedFuelUtxo,
  pickSplitSourceUtxo,
} from './fuelUtxo.js';

export async function peelSizedFuel(wallet: Wallet): Promise<string | null> {
  await wallet.sync();
  if (pickSizedFuelUtxo(wallet.utxos)) return null;
  const big = pickSplitSourceUtxo(wallet.utxos);
  if (!big) {
    throw new Error(
      `Need XEC ≥ ${Number(REMINT_FUEL_SATS) / 100} for a sized remint fee UTXO`,
    );
  }

  const { payment } = await import('ecash-lib');
  const action: payment.Action = {
    outputs: [{ sats: REMINT_FUEL_SATS, script: wallet.script }],
  };

  const receiveScript = wallet.script;
  const previous = wallet.getChangeScript.bind(wallet);
  (wallet as { getChangeScript: () => Script }).getChangeScript = () =>
    receiveScript;

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
