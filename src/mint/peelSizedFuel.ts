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
 * Desk (tip-funding) → tip: **only** ~40 XEC fuel lands on tip.
 * Change is forced onto desk.script (never tip, never BIP44 change chain).
 *
 * Old bug (tx c0b95968…): peel/top-up put both 40 XEC and change on the tip,
 * draining the funding UTXO. This function asserts post-build that tip receives
 * only the sized fuel output.
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

  const { payment, toHex } = await import('ecash-lib');
  const action: payment.Action = {
    // Exactly one payment output: sized fuel → tip. Change via getChangeScript.
    outputs: [{ sats: REMINT_FUEL_SATS, script: tip.script }],
  };

  const deskScript = desk.script;
  const tipScriptHex = toHex(tip.script);
  const deskScriptHex = toHex(deskScript);

  if (tipScriptHex === deskScriptHex) {
    throw new Error(
      'Desk and tip scripts are identical — cannot route fuel vs change',
    );
  }

  const previous = desk.getChangeScript.bind(desk);
  (desk as { getChangeScript: () => Script }).getChangeScript = () =>
    deskScript;

  let built: {
    builtTxs?: { outputs: { sats: bigint; script?: { bytecode?: Uint8Array } }[] }[];
    broadcast: () => Promise<{ success: boolean; broadcasted?: string[] }>;
  };
  try {
    built = desk.action(action).build() as typeof built;
    // Post-build integrity: tip may only receive the sized fuel out.
    const tx = built.builtTxs?.[0];
    if (tx?.outputs?.length) {
      let tipFuelOuts = 0;
      let tipOtherSats = 0n;
      let deskChangeSats = 0n;
      for (const o of tx.outputs) {
        const scr = o.script?.bytecode
          ? toHex(o.script.bytecode as unknown as Uint8Array)
          : o.script
            ? toHex(o.script as unknown as Uint8Array)
            : '';
        // Script objects may expose bytecode via ser — fall back to string match
        const scriptHex = (() => {
          try {
            if (o.script && typeof (o.script as { ser?: () => Uint8Array }).ser === 'function') {
              return toHex((o.script as { ser: () => Uint8Array }).ser());
            }
          } catch { /* ignore */ }
          return scr;
        })();
        if (!scriptHex) continue;
        if (scriptHex === tipScriptHex) {
          if (o.sats === REMINT_FUEL_SATS) tipFuelOuts++;
          else tipOtherSats += o.sats;
        } else if (scriptHex === deskScriptHex) {
          deskChangeSats += o.sats;
        }
      }
      if (tipFuelOuts !== 1 || tipOtherSats > 0n) {
        throw new Error(
          `Desk→tip fuel integrity failed: tipFuelOuts=${tipFuelOuts} tipOtherSats=${tipOtherSats} (change must stay on desk)`,
        );
      }
    }
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
