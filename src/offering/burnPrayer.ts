/**
 * Offering helpers (web + mint API).
 * WLotus: remint mints 100 (1 miner + 99 temple) → burn the miner 1 with WLBR.
 * Legacy Prayer memo path may still embed WLBR on mint without a burn tx.
 */
import { ALP_TOKEN_TYPE_STANDARD, payment } from 'ecash-lib';
import type { Wallet } from 'ecash-wallet';

export const WLBR_LOKAD = new TextEncoder().encode('WLBR');
export const WLBR_VERSION = 1;

export const OFFERING_ID_PRAYER = 'prayer' as const;
export const OFFERING_ID_WLOTUS = 'wlotus' as const;
/** @deprecated use OFFERING_ID_PRAYER */
export const OFFERING_ID = OFFERING_ID_PRAYER;

/** EMPP memorial push: WLBR | ver | offeringIdLen | offeringId | noteLen | noteUtf8 */
export function memorialPushdata(
  note: string,
  offeringId: string = OFFERING_ID_PRAYER,
): Uint8Array {
  const idBytes = new TextEncoder().encode(offeringId);
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

/** Burn exactly 1 atom with on-chain memorial (WLBR). */
export async function burnOnePrayer(opts: {
  wallet: Wallet;
  tokenId: string;
  note?: string;
  offeringId?: string;
}): Promise<{ txid: string }> {
  const note = (opts.note ?? '').trim();
  const offeringId = opts.offeringId ?? OFFERING_ID_PRAYER;
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
        data: memorialPushdata(note, offeringId),
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
