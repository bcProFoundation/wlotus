/**
 * Follow a PoW mint-baton lineage on Chronik.
 *
 * Open miners remint without mint-api, so lastRemintTxid / powAddress in the
 * deployment JSON can be a spent P2SH. The live tip is always on-chain:
 * walk spentBy from the last known baton outpoint until the mint baton is
 * unspent, then rebuild the covenant from that tx's locktime.
 *
 * Genesis handoffs share one P2SH (same tipLocktime). After a remint that
 * baton moves to a new P2SH whose tipLocktime is the remint locktime.
 */
import type { Tx, TxOutput } from 'chronik-client';

export const FOLLOW_BATON_MAX_HOPS = 10_000;

export type FollowMintBatonUtxo = {
  outpoint: { txid: string; outIdx: number };
  sats: bigint;
  script: string;
  token?: { tokenId?: string; isMintBaton?: boolean };
};

/** Chronik surface used to follow a mint baton (full client satisfies this). */
export type FollowChronik = {
  tx: (txid: string) => Promise<Tx>;
  tokenId: (tokenId: string) => {
    utxos: () => Promise<{ utxos?: FollowMintBatonUtxo[] }>;
  };
};

export interface LiveMintBaton {
  txid: string;
  outIdx: number;
  sats: bigint;
  outputScript: string;
  /** Tx that created this UTXO (genesis handoff or a remint). */
  creatingTxid: string;
  creatingLockTime: number;
  hops: number;
}

export function findMintBatonOutIdx(tx: Tx, tokenId: string): number {
  const want = tokenId.toLowerCase();
  const idx = tx.outputs.findIndex(
    o =>
      o.token?.tokenId?.toLowerCase() === want && o.token?.isMintBaton === true,
  );
  if (idx < 0) {
    throw new Error(
      `No mint baton output for ${want.slice(0, 8)}… in ${tx.txid}`,
    );
  }
  return idx;
}

function isMintBatonOut(
  o: TxOutput | FollowMintBatonUtxo,
  tokenId: string,
): boolean {
  const want = tokenId.toLowerCase();
  return (
    o.token?.tokenId?.toLowerCase() === want && o.token?.isMintBaton === true
  );
}

/**
 * Walk spentBy from `startTxid` until the mint baton UTXO is unspent.
 * `startOutIdx` optional — defaults to the first mint-baton output in startTx.
 */
export async function walkToUnspentMintBaton(
  chronik: FollowChronik,
  tokenId: string,
  startTxid: string,
  startOutIdx?: number,
): Promise<LiveMintBaton> {
  const want = tokenId.toLowerCase();
  let txid = startTxid.toLowerCase();
  let outIdx = startOutIdx;
  const seen = new Set<string>();

  for (let hop = 0; hop < FOLLOW_BATON_MAX_HOPS; hop++) {
    const tx = await chronik.tx(txid);
    if (outIdx === undefined) outIdx = findMintBatonOutIdx(tx, want);
    const key = `${txid}:${outIdx}`;
    if (seen.has(key)) {
      throw new Error(`Mint baton walk cycled at ${key}`);
    }
    seen.add(key);
    const out = tx.outputs[outIdx];
    if (!out) {
      throw new Error(`Missing output ${key}`);
    }
    if (!isMintBatonOut(out, want)) {
      throw new Error(`Output ${key} is not a mint baton for this token`);
    }
    if (!out.spentBy) {
      return {
        txid,
        outIdx,
        sats: out.sats,
        outputScript: out.outputScript,
        creatingTxid: tx.txid.toLowerCase(),
        creatingLockTime: tx.lockTime,
        hops: hop,
      };
    }
    // spentBy.outIdx is the spending *input* index — load that tx and find
    // its mint-baton *output* (the next covenant P2SH).
    const spendTx = await chronik.tx(out.spentBy.txid);
    txid = spendTx.txid.toLowerCase();
    outIdx = findMintBatonOutIdx(spendTx, want);
  }
  throw new Error(
    `Mint baton walk exceeded ${FOLLOW_BATON_MAX_HOPS} hops from ${startTxid}`,
  );
}

/**
 * If the lineage walk fails (stale JSON, missing start tx), pick any live
 * mint-baton UTXO for this tokenId from Chronik.
 */
export async function findAnyLiveMintBaton(
  chronik: FollowChronik,
  tokenId: string,
): Promise<LiveMintBaton> {
  const want = tokenId.toLowerCase();
  const page = await chronik.tokenId(want).utxos();
  const baton = (page.utxos ?? []).find(u => isMintBatonOut(u, want));
  if (!baton) {
    throw new Error(`No live mint batons for token ${want.slice(0, 8)}…`);
  }
  const tx = await chronik.tx(baton.outpoint.txid);
  return {
    txid: baton.outpoint.txid.toLowerCase(),
    outIdx: baton.outpoint.outIdx,
    sats: baton.sats,
    outputScript: baton.script,
    creatingTxid: tx.txid.toLowerCase(),
    creatingLockTime: tx.lockTime,
    hops: 0,
  };
}

export async function resolveLiveMintBaton(
  chronik: FollowChronik,
  tokenId: string,
  startTxid: string | null | undefined,
): Promise<LiveMintBaton> {
  if (startTxid && /^[0-9a-fA-F]{64}$/.test(startTxid)) {
    try {
      return await walkToUnspentMintBaton(chronik, tokenId, startTxid);
    } catch (e) {
      console.warn(
        `Baton lineage from ${startTxid.slice(0, 8)}… failed (${e instanceof Error ? e.message : e}); scanning token UTXOs`,
      );
    }
  }
  return findAnyLiveMintBaton(chronik, tokenId);
}

export interface CovenantAtLocktime {
  address: string;
  p2shScriptHex: string;
  tipLocktime: number;
}

/** Chronik locking-script hex vs `toHex(p2shScript.bytecode)`. */
export function lockingScriptsEqual(a: string, b: string): boolean {
  const na = a.replace(/^0x/i, '').toLowerCase();
  const nb = b.replace(/^0x/i, '').toLowerCase();
  if (na === nb) return true;
  const hash = (s: string): string | undefined => {
    if (s.length === 40 && /^[0-9a-f]+$/.test(s)) return s;
    const m = /^a914([0-9a-f]{40})87$/.exec(s);
    return m?.[1];
  };
  const ha = hash(na);
  const hb = hash(nb);
  return Boolean(ha && hb && ha === hb);
}

/**
 * Rebuild the covenant whose P2SH matches the live baton output.
 * Try the creating tx locktime first (open-miner remint), then genesis
 * tipLocktime (handoff still sitting on the original P2SH).
 */
export async function matchCovenantToBaton<T extends CovenantAtLocktime>(
  live: LiveMintBaton,
  locktimeCandidates: number[],
  createAt: (tipLocktime: number) => Promise<T>,
): Promise<T> {
  const seen = new Set<number>();
  const ordered = [
    live.creatingLockTime,
    ...locktimeCandidates,
  ].filter(n => Number.isInteger(n) && n >= 0 && !seen.has(n) && (seen.add(n), true));

  let lastErr: unknown;
  for (const lt of ordered) {
    try {
      const c = await createAt(lt);
      if (lockingScriptsEqual(c.p2shScriptHex, live.outputScript)) return c;
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(
    `Could not reconstruct covenant P2SH for baton ${live.txid}:${live.outIdx}` +
      (lastErr instanceof Error ? ` (${lastErr.message})` : ''),
  );
}
