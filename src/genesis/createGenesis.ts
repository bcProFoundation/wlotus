import {
  BASE_MINT_ATOMS,
  POW_BATON_COUNT,
  POW_BATON_COUNT_MAX,
  POW_LEADING_ZERO_BYTES,
  TOKEN_DECIMALS,
  TOKEN_NAME,
  TOKEN_TICKER,
  TOKEN_URL,
} from '../params/consensus.js';

/**
 * Draft GENESIS plan for WLOTUS.
 *
 * Implementation will use ecash-lib `alpGenesis` + eMPP, then send each of the
 * N mint batons to the remint covenant P2SH (same redeem, batonIndex 0..N-1).
 *
 * This module currently only describes the intended outputs — no broadcast.
 */
export interface GenesisPlan {
  ticker: string;
  name: string;
  url: string;
  decimals: number;
  /** Initial fungible mint to treasury/miner bootstrap (may be 0). */
  initialMintAtoms: bigint;
  /** Parallel PoW batons. */
  powBatonCount: number;
  powLeadingZeroBytes: number;
  baseMintAtoms: bigint;
}

export function buildGenesisPlan(
  overrides: Partial<GenesisPlan> = {},
): GenesisPlan {
  return {
    ticker: TOKEN_TICKER,
    name: TOKEN_NAME,
    url: TOKEN_URL,
    decimals: TOKEN_DECIMALS,
    initialMintAtoms: 0n,
    powBatonCount: POW_BATON_COUNT,
    powLeadingZeroBytes: POW_LEADING_ZERO_BYTES,
    baseMintAtoms: BASE_MINT_ATOMS,
    ...overrides,
  };
}

export function assertMultiBaton(plan: GenesisPlan): void {
  if (plan.powBatonCount < 2) {
    throw new Error('WLOTUS requires N >= 2 PoW mint batons for parallel remints');
  }
  if (plan.powBatonCount > POW_BATON_COUNT_MAX) {
    throw new Error(
      `powBatonCount ${plan.powBatonCount} exceeds ALP genesis max ${POW_BATON_COUNT_MAX}`,
    );
  }
}
