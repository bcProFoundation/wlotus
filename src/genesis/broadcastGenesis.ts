import {
  ALP_TOKEN_TYPE_STANDARD,
  DEFAULT_DUST_SATS,
  payment,
  toHex,
  type Script,
} from 'ecash-lib';
import type { Wallet } from 'ecash-wallet';
import {
  BASE_MINT_ATOMS,
  TOKEN_DECIMALS,
  TOKEN_URL,
} from '../params/consensus.js';
import {
  TEST_INITIAL_MINT_ATOMS,
  TEST_POW_BATON_COUNT,
  TEST_POW_LEADING_ZERO_BYTES,
  TEST_TOKEN_NAME,
  TEST_TOKEN_TICKER,
} from '../params/testEconomics.js';
import { assertMultiBaton, buildGenesisPlan } from './createGenesis.js';

export interface BroadcastGenesisOptions {
  /** Override initial fungible mint atoms. */
  initialMintAtoms?: bigint;
  /** Override baton count (must be ≥ 2). */
  powBatonCount?: number;
  /** Dust sats per token/baton output. */
  dustSats?: bigint;
  /** Token ticker. */
  ticker?: string;
  /** Token name. */
  name?: string;
  /** Decimals. */
  decimals?: number;
  /** Document URL. */
  url?: string;
}

export interface BroadcastGenesisResult {
  tokenId: string;
  txids: string[];
  ticker: string;
  name: string;
  decimals: number;
  initialMintAtoms: string;
  powBatonCount: number;
  powLeadingZeroBytes: number;
  baseMintAtoms: string;
  genesisAddress: string;
  authPubkey: string;
}

function batonOutputs(
  script: Script,
  count: number,
  dustSats: bigint,
): payment.PaymentOutput[] {
  const outs: payment.PaymentOutput[] = [];
  for (let i = 0; i < count; i++) {
    outs.push({
      sats: dustSats,
      script,
      tokenId: payment.GENESIS_TOKEN_ID_PLACEHOLDER,
      isMintBaton: true,
      atoms: 0n,
    });
  }
  return outs;
}

/**
 * Build an ALP GENESIS Action: initial mint + N mint batons to `script`.
 * Batons are held by the genesis wallet for custodial remint dogfooding
 * until the PoW covenant is production-ready.
 */
export function buildAlpGenesisAction(
  script: Script,
  authPubkeyHex: string,
  opts: BroadcastGenesisOptions = {},
): payment.Action {
  const plan = buildGenesisPlan({
    ticker: opts.ticker ?? TEST_TOKEN_TICKER,
    name: opts.name ?? TEST_TOKEN_NAME,
    url: opts.url ?? TOKEN_URL,
    decimals: opts.decimals ?? TOKEN_DECIMALS,
    initialMintAtoms: opts.initialMintAtoms ?? TEST_INITIAL_MINT_ATOMS,
    powBatonCount: opts.powBatonCount ?? TEST_POW_BATON_COUNT,
  });
  assertMultiBaton(plan);

  const dustSats = opts.dustSats ?? DEFAULT_DUST_SATS;
  const outputs: payment.PaymentOutput[] = [{ sats: 0n }];

  if (plan.initialMintAtoms > 0n) {
    outputs.push({
      sats: dustSats,
      script,
      tokenId: payment.GENESIS_TOKEN_ID_PLACEHOLDER,
      atoms: plan.initialMintAtoms,
    });
  }

  outputs.push(...batonOutputs(script, plan.powBatonCount, dustSats));

  return {
    outputs,
    tokenActions: [
      {
        type: 'GENESIS',
        tokenType: ALP_TOKEN_TYPE_STANDARD,
        genesisInfo: {
          tokenTicker: plan.ticker,
          tokenName: plan.name,
          url: plan.url,
          decimals: plan.decimals,
          authPubkey: authPubkeyHex,
        },
      },
    ],
  };
}

/**
 * Sync wallet, broadcast ALP GENESIS, return tokenId (= genesis txid).
 */
export async function broadcastAlpGenesis(
  wallet: Wallet,
  opts: BroadcastGenesisOptions = {},
): Promise<BroadcastGenesisResult> {
  await wallet.sync();

  const dustSats = opts.dustSats ?? DEFAULT_DUST_SATS;
  const batons = opts.powBatonCount ?? TEST_POW_BATON_COUNT;
  const mintAtoms = opts.initialMintAtoms ?? TEST_INITIAL_MINT_ATOMS;
  const mintOutputs = (mintAtoms > 0n ? 1 : 0) + batons;
  const minSatsNeeded = dustSats * BigInt(mintOutputs) + 5_000n; // fee headroom

  if (wallet.balanceSats < minSatsNeeded) {
    throw new Error(
      `Insufficient XEC: have ${wallet.balanceSats} sats at ${wallet.address}, ` +
        `need ≥ ${minSatsNeeded} sats (~${Number(minSatsNeeded) / 100} XEC). ` +
        `Send mainnet XEC to the genesis address and re-run.`,
    );
  }

  const action = buildAlpGenesisAction(wallet.script, toHex(wallet.pk), opts);
  const built = wallet.action(action).build();
  const resp = await built.broadcast();

  if (!resp.success || !resp.broadcasted?.length) {
    throw new Error(
      `Genesis broadcast failed: ${JSON.stringify(resp, (_k, v) =>
        typeof v === 'bigint' ? v.toString() : v,
      )}`,
    );
  }

  const tokenId = resp.broadcasted[0];
  const plan = buildGenesisPlan({
    ticker: opts.ticker ?? TEST_TOKEN_TICKER,
    name: opts.name ?? TEST_TOKEN_NAME,
    url: opts.url ?? TOKEN_URL,
    decimals: opts.decimals ?? TOKEN_DECIMALS,
    initialMintAtoms: mintAtoms,
    powBatonCount: batons,
  });

  return {
    tokenId,
    txids: resp.broadcasted,
    ticker: plan.ticker,
    name: plan.name,
    decimals: plan.decimals,
    initialMintAtoms: plan.initialMintAtoms.toString(),
    powBatonCount: plan.powBatonCount,
    powLeadingZeroBytes: TEST_POW_LEADING_ZERO_BYTES,
    baseMintAtoms: BASE_MINT_ATOMS.toString(),
    genesisAddress: wallet.address,
    authPubkey: toHex(wallet.pk),
  };
}
