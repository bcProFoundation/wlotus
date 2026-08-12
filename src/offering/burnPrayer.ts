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
 * Temple specials may burn more than 1 during an active event window.
 *
 * Pure-XEC change stays on the mint/tip **receive** script (`wallet.script`)
 * unless `changeScript` is set. Do not route leftover XEC to the desk — that
 * swallows the next remint fuel UTXOs. HD wallets must not use the default
 * BIP44 change chain (…/1/i).
 *
 * Extra fee inputs prefer the smallest non-token UTXO so sized remint fuels
 * (~40 XEC) are left for the next offering.
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
   * Force pure-XEC change onto this script. Defaults to wallet.script
   * (mint receive). Do not pass the desk / funding address.
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

  const outputs: payment.PaymentOutput[] = [{ sats: 0n }];
  const tokenActions: payment.TokenAction[] = [];

  if (inventoryAtoms > 0n && opts.inventoryScript) {
    // Explicit SEND leftover → inventory (temple); BURN the flower atoms.
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

  // Token UTXOs + the smallest extra pure-XEC coin (fee). Prefer leftover
  // dust (< remint fuel size) so sized ~40 XEC fuels stay for the next mint.
  const extraPure = opts.wallet.utxos
    .filter(u => !u.token)
    .sort((a, b) => (a.sats < b.sats ? -1 : a.sats > b.sats ? 1 : 0));
  const dustFee = extraPure.find(u => u.sats < 4_000n);
  const feeUtxo = dustFee ?? extraPure[0];
  const requiredUtxos = [
    ...tokenUtxos.map(u => u.outpoint),
    ...(feeUtxo ? [feeUtxo.outpoint] : []),
  ];

  const action: payment.Action = {
    outputs,
    tokenActions,
    requiredUtxos,
  };

  // Always pin change to mint receive (or caller override) — never BIP44 …/1/i.
  const changeScript = opts.changeScript ?? opts.wallet.script;
  const previous = opts.wallet.getChangeScript.bind(opts.wallet);
  (opts.wallet as { getChangeScript: () => Script }).getChangeScript = () =>
    changeScript;

  let resp: { success: boolean; broadcasted?: string[] };
  try {
    const built = opts.wallet.action(action).build();
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

export function explorerTx(txid: string): string {
  return `https://explorer.e.cash/tx/${txid}`;
}

export function shortTx(txid: string): string {
  return `${txid.slice(0, 8)}…${txid.slice(-6)}`;
}
