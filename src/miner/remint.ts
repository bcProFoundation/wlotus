import { mintAtomsAtHostHeight } from '../lib/moore.js';
import { POW_BATON_COUNT, POW_LEADING_ZERO_BYTES } from '../params/consensus.js';

/**
 * Remint miner sketch (Chronik + ecash-lib).
 *
 * Loop:
 * 1. List unspent PoW baton UTXOs for tokenId (N tips)
 * 2. For each baton, build ALP MINT template + covenant unlock
 * 3. Search nonce until hash256(preimage||nonce) meets difficulty
 * 4. Broadcast; on conflict, refresh baton set and retry
 *
 * No Mist-style wait-for-next-host-block gating.
 */
export interface RemintTarget {
  tokenId: string;
  genesisHostHeight: number;
  currentHostHeight: number;
  batonOutpoint: { txid: string; vout: number };
  batonIndex: number;
}

export function expectedMintAtoms(target: RemintTarget): bigint {
  return mintAtomsAtHostHeight(
    target.genesisHostHeight,
    target.currentHostHeight,
  );
}

export function minerBanner(): string {
  return [
    'WLOTUS remint miner',
    `batons(N)=${POW_BATON_COUNT}`,
    `powLeadingZeroBytes=${POW_LEADING_ZERO_BYTES}`,
    'moore=99918/100000 per 144 host blocks',
    'parallel remints: enabled (no 1-mint/block CLTV)',
  ].join(' | ');
}

/** Placeholder — wire Chronik + ecash-lib in a follow-up. */
export async function runMinerLoop(_tokenId: string): Promise<never> {
  console.log(minerBanner());
  throw new Error('Miner not implemented yet — covenant + Chronik wiring TODO');
}
