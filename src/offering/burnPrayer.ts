/**
 * Offering helpers (web + mint API).
 * wLotus: remint mints 108 (102 miner + 6 temple) → burn miner atoms with **DANA**.
 * Legacy Prayer memo path may still embed memorial EMPP on mint without a burn tx.
 */
import { ALP_TOKEN_TYPE_STANDARD, payment } from 'ecash-lib';
import type { Wallet } from 'ecash-wallet';
import {
  memorialPushdata,
  OFFERING_ID_PRAYER,
  parseParentBurnTxidHex,
} from './wlbrMemorial.js';

export {
  memorialPushdata,
  parseMemorialPushdata,
  parseParentBurnTxidHex,
  DANA_LOKAD,
  DANA_VERSION,
  DANA_VERSION_PARENT,
  DANA_PARENT_TXID_LEN,
  OFFERING_ID_PRAYER,
  OFFERING_ID_WLOTUS,
  OFFERING_ID,
  type MemorialFields,
} from './wlbrMemorial.js';

/**
 * Burn `burnAtoms` (default 1) with on-chain memorial (**DANA** LOKAD).
 * Hungry Ghost special day burns the full miner share (102).
 */
export async function burnOnePrayer(opts: {
  wallet: Wallet;
  tokenId: string;
  note?: string;
  offeringId?: string;
  /** Original dedication burn txid (hex) — DANA v2 star link for explorers. */
  parentBurnTxid?: string;
  /** Atoms to burn (default 1). Must be ≥ 1. */
  burnAtoms?: bigint;
}): Promise<{ txid: string; burnAtoms: bigint }> {
  const note = (opts.note ?? '').trim();
  const offeringId = opts.offeringId ?? OFFERING_ID_PRAYER;
  const parentBurnTxid = opts.parentBurnTxid
    ? parseParentBurnTxidHex(opts.parentBurnTxid)
    : undefined;
  const burnAtoms = opts.burnAtoms ?? 1n;
  if (burnAtoms < 1n) {
    throw new Error(`burnAtoms must be ≥ 1 (got ${burnAtoms})`);
  }
  const action: payment.Action = {
    outputs: [{ sats: 0n }],
    tokenActions: [
      {
        type: 'BURN',
        tokenId: opts.tokenId,
        tokenType: ALP_TOKEN_TYPE_STANDARD,
        burnAtoms,
      },
      {
        type: 'DATA',
        data: memorialPushdata(note, offeringId, parentBurnTxid),
      },
    ],
  };

  const built = opts.wallet.action(action).build();
  const resp = await built.broadcast();
  if (!resp.success || !resp.broadcasted?.length) {
    throw new Error(`Burn broadcast failed: ${JSON.stringify(resp)}`);
  }
  return { txid: resp.broadcasted[0]!, burnAtoms };
}

export function explorerTx(txid: string): string {
  return `https://explorer.e.cash/tx/${txid}`;
}

export function shortTx(txid: string): string {
  return `${txid.slice(0, 8)}…${txid.slice(-6)}`;
}
