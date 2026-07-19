import { ALP_TOKEN_TYPE_STANDARD, payment } from 'ecash-lib';
import type { Wallet } from 'ecash-wallet';
import {
  OFFERINGS,
  PRAYER_TOKEN_ID,
  WLBR_LOKAD,
  WLBR_VERSION,
  type OfferingId,
} from './config.js';

/** EMPP memorial push: WLBR | ver | offeringIdLen | offeringId | noteLen | noteUtf8 */
export function memorialPushdata(
  offeringId: OfferingId,
  note: string,
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

export function offeringById(id: OfferingId) {
  const o = OFFERINGS.find(x => x.id === id);
  if (!o) throw new Error(`Unknown offering ${id}`);
  return o;
}

/**
 * Burn Prayer atoms; fees paid in XEC from the same wallet.
 * Postage server can replace the XEC fee input later.
 */
export async function burnPrayerOffering(opts: {
  wallet: Wallet;
  offeringId: OfferingId;
  note?: string;
  tokenId?: string;
}): Promise<{ txids: string[] }> {
  const { wallet, offeringId } = opts;
  const tokenId = opts.tokenId ?? PRAYER_TOKEN_ID;
  const offering = offeringById(offeringId);
  const note = (opts.note ?? '').trim();

  const action: payment.Action = {
    outputs: [{ sats: 0n }],
    tokenActions: [
      {
        type: 'BURN',
        tokenId,
        tokenType: ALP_TOKEN_TYPE_STANDARD,
        burnAtoms: offering.atoms,
      },
      {
        type: 'DATA',
        data: memorialPushdata(offeringId, note),
      },
    ],
  };

  const built = wallet.action(action).build();
  const resp = await built.broadcast();
  if (!resp.success || !resp.broadcasted?.length) {
    throw new Error(`Burn broadcast failed: ${JSON.stringify(resp)}`);
  }
  return { txids: resp.broadcasted };
}

export function explorerTx(txid: string): string {
  return `https://explorer.e.cash/tx/${txid}`;
}

export function shortTx(txid: string): string {
  return `${txid.slice(0, 8)}…${txid.slice(-6)}`;
}
