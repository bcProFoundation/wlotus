/**
 * Shared Prayer offering helpers (web + mint API).
 * Dual-mint design: remint mints 2 → burn 1 (offering) → keep 1 (desk).
 */
import { ALP_TOKEN_TYPE_STANDARD, payment } from 'ecash-lib';
import type { Wallet } from 'ecash-wallet';

export const WLBR_LOKAD = new TextEncoder().encode('WLBR');
export const WLBR_VERSION = 1;

export const OFFERING_ID = 'prayer' as const;

/** EMPP memorial push: WLBR | ver | offeringIdLen | offeringId | noteLen | noteUtf8 */
export function memorialPushdata(note: string): Uint8Array {
  const idBytes = new TextEncoder().encode(OFFERING_ID);
  const noteBytes = new TextEncoder().encode(note.slice(0, 80));
  if (idBytes.length > 255 || noteBytes.length > 255) {
    throw new Error('memorial fields too long');
  }
  const out = new Uint8Array(
    4 + 1 + 1 + idBytes.length + 1 + noteBytes.length,
  );
  let o = 0;
  out.set(WLBR_LOKAD, o);
  o += 4;
  out[o++] = WLBR_VERSION;
  out[o++] = idBytes.length;
  out.set(idBytes, o);
  o += idBytes.length;
  out[o++] = noteBytes.length;
  out.set(noteBytes, o);
  return out;
}

/** Burn exactly 1 Prayer atom; remainder stays on the same wallet (desk). */
export async function burnOnePrayer(opts: {
  wallet: Wallet;
  tokenId: string;
  note?: string;
}): Promise<{ txid: string }> {
  const note = (opts.note ?? '').trim();
  const action: payment.Action = {
    outputs: [{ sats: 0n }],
    tokenActions: [
      {
        type: 'BURN',
        tokenId: opts.tokenId,
        tokenType: ALP_TOKEN_TYPE_STANDARD,
        burnAtoms: 1n,
      },
      {
        type: 'DATA',
        data: memorialPushdata(note),
      },
    ],
  };

  const built = opts.wallet.action(action).build();
  const resp = await built.broadcast();
  if (!resp.success || !resp.broadcasted?.length) {
    throw new Error(`Burn broadcast failed: ${JSON.stringify(resp)}`);
  }
  return { txid: resp.broadcasted[0]! };
}

export function explorerTx(txid: string): string {
  return `https://explorer.e.cash/tx/${txid}`;
}

export function shortTx(txid: string): string {
  return `${txid.slice(0, 8)}…${txid.slice(-6)}`;
}
