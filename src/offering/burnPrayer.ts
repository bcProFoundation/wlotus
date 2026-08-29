/**
 * Offering helpers (web + mint API).
 * wLotus: remint mints 108 (102 miner + 6 temple) → burn miner atoms with **DANA**.
 * Legacy Prayer memo path may still embed memorial EMPP on mint without a burn tx.
 */
import {
  ALP_TOKEN_TYPE_STANDARD,
  DEFAULT_DUST_SATS,
  payment,
  type Script,
} from 'ecash-lib';
import type { Wallet } from 'ecash-wallet';
import { pickBurnPostageUtxo } from '../mint/fuelUtxo.js';
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

export { explorerTx, danaExplorerOrigin, DEFAULT_DANA_EXPLORER_ORIGIN } from '../explorer.js';

/**
 * Burn `burnAtoms` (default 1) with on-chain memorial (**DANA** LOKAD).
 * Temple specials may burn more than 1 during an active event window.
 *
 * Fee input is **only** a small burn-postage UTXO (15–35 XEC). Never attach
 * an oversized tip reserve. Pass `changeScript` as the **desk** so leftover
 * XEC returns to treasury. Pinning postage in `requiredUtxos` is what keeps
 * sibling remint fuels from being swallowed (the old desk-change bug).
 * HD wallets must not use the default BIP44 change chain (…/1/i).
 *
 * `inventoryScript`: leftover token atoms after the burn (temple cold storage).
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
  /**
   * Pure-XEC change. Offering path: desk treasury script.
   * Defaults to wallet.script (mint receive).
   */
  changeScript?: Script;
  /**
   * Leftover token atoms after burn are sent here (e.g. temple P2SH cold storage).
   * If omitted, leftover inventory follows wallet change (not recommended on tip HD).
   */
  inventoryScript?: Script;
}): Promise<{ txid: string; burnAtoms: bigint; inventoryAtoms: bigint }> {
  const note = (opts.note ?? '').trim();
  const offeringId = opts.offeringId ?? OFFERING_ID_PRAYER;
  const parentBurnTxid = opts.parentBurnTxid
    ? parseParentBurnTxidHex(opts.parentBurnTxid)
    : undefined;
  const burnAtoms = opts.burnAtoms ?? 1n;
  if (burnAtoms < 1n) {
    throw new Error(`burnAtoms must be ≥ 1 (got ${burnAtoms})`);
  }

  await opts.wallet.sync();
  const tokenUtxos = opts.wallet.utxos.filter(
    u =>
      u.token?.tokenId === opts.tokenId &&
      u.token.atoms != null &&
      !u.token.isMintBaton,
  );
  const totalAtoms = tokenUtxos.reduce(
    (sum, u) => sum + BigInt(u.token!.atoms),
    0n,
  );
  if (totalAtoms < burnAtoms) {
    throw new Error(
      `Need ≥ ${burnAtoms} atoms of ${opts.tokenId.slice(0, 8)}… (have ${totalAtoms})`,
    );
  }
  const inventoryAtoms = totalAtoms - burnAtoms;

  // Token UTXOs + postage only. Do **not** fall back to the largest/only
  // pure coin: a 1M-XEC reserve on the tip would be spent as miner fee.
  const feeUtxo = pickBurnPostageUtxo(opts.wallet.utxos);
  if (!feeUtxo) {
    throw new Error(
      'Tip needs a small burn-postage UTXO (15–35 XEC). Oversized reserves are not spent.',
    );
  }
  const requiredUtxos = [
    ...tokenUtxos.map(u => u.outpoint),
    feeUtxo.outpoint,
  ];

  const changeScript = opts.changeScript ?? opts.wallet.script;
  const previous = opts.wallet.getChangeScript.bind(opts.wallet);
  (opts.wallet as { getChangeScript: () => Script }).getChangeScript = () =>
    changeScript;

  const buildWithInventory = (includeInventory: boolean) => {
    const outputs: payment.PaymentOutput[] = [{ sats: 0n }];
    const tokenActions: payment.TokenAction[] = [];
    if (includeInventory && inventoryAtoms > 0n && opts.inventoryScript) {
      tokenActions.push({
        type: 'SEND',
        tokenId: opts.tokenId,
        tokenType: ALP_TOKEN_TYPE_STANDARD,
      });
      outputs.push({
        sats: DEFAULT_DUST_SATS,
        script: opts.inventoryScript,
        tokenId: opts.tokenId,
        atoms: inventoryAtoms,
        isMintBaton: false,
      });
    }
    tokenActions.push({
      type: 'BURN',
      tokenId: opts.tokenId,
      tokenType: ALP_TOKEN_TYPE_STANDARD,
      burnAtoms,
    });
    tokenActions.push({
      type: 'DATA',
      data: memorialPushdata(note, offeringId, parentBurnTxid),
    });
    return opts.wallet.action({ outputs, tokenActions, requiredUtxos }).build();
  };

  let resp: { success: boolean; broadcasted?: string[] };
  try {
    let built;
    try {
      built = buildWithInventory(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('OP_RETURN of') || !opts.inventoryScript) throw e;
      // Leftover ALP SEND + a long DANA note can exceed 223. Burn the
      // memorial without the inventory SEND so the flower still lands.
      built = buildWithInventory(false);
    }
    resp = await built.broadcast();
  } finally {
    (opts.wallet as { getChangeScript: () => Script }).getChangeScript =
      previous;
  }

  if (!resp.success || !resp.broadcasted?.length) {
    throw new Error(`Burn broadcast failed: ${JSON.stringify(resp)}`);
  }
  return {
    txid: resp.broadcasted[0]!,
    burnAtoms,
    inventoryAtoms,
  };
}

export function shortTx(txid: string): string {
  return `${txid.slice(0, 8)}…${txid.slice(-6)}`;
}
