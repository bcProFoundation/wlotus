/**
 * Fund per-tip fee wallets from the main mint desk (tip-funding address).
 *
 * Remint has no change out — tips only hold small sized remint fuels and
 * burn-postage coins. Treasury stays on the desk. Each send is one tx with
 * two outputs (fuel + postage); change stays on desk. Burn leftover XEC
 * returns to the desk.
 * This script:
 *   1. Derives tip HD accounts from MINT_MNEMONIC (account tipIndex+1)
 *   2. Sends REMINT_FUEL_SATS × N from desk → tip (change remains on desk)
 *   3. Reclaims oversized pure XEC stuck on tip (change → desk)
 *
 * Usage (Contabo or local):
 *   MINT_MNEMONIC="…" MINT_SERVING_TIP_COUNT=1 npm run fund-tip-fee-wallets
 *   MINT_SERVING_TIP_INDEX=27 MINT_SERVING_TIP_COUNT=1 npm run fund-tip-fee-wallets
 *
 * Dry-run (addresses + balances only):
 *   FUND_DRY_RUN=1 MINT_MNEMONIC="…" npm run fund-tip-fee-wallets
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createChronik } from '../src/network/createChronik.js';
import { loadMintWallet, mintWalletSummary } from '../src/mint/loadMintWallet.js';
import {
  loadTipFeeWallet,
  tipFeeWalletSummary,
} from '../src/mint/loadTipFeeWallet.js';
import {
  BURN_POSTAGE_SATS,
  OFFERING_PAIR_SATS,
  REMINT_FUEL_SATS,
  isBurnPostageSats,
  isSizedFuelSats,
  pickSplitSourceUtxo,
  pureXecBalance,
} from '../src/mint/fuelUtxo.js';
import {
  parseServingTipCount,
  parseServingTipIndex,
} from '../src/mint/servingTips.js';

loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: '/etc/wlotus/mint.env', override: true });

const SERVING = parseServingTipCount();
const INDEX = parseServingTipIndex();
const DRY = /^(1|true|yes)$/i.test(process.env.FUND_DRY_RUN?.trim() || '');
/** Keep this much pure XEC on the desk after funding (sats). */
const DESK_RESERVE_SATS = BigInt(
  process.env.MINT_DESK_RESERVE_SATS?.trim() || '10000',
);
/** How many sized fuel coins to try to leave on each tip after funding. */
const FUELS_PER_TIP = Math.max(
  1,
  Number(process.env.MINT_FUELS_PER_TIP?.trim() || 3) || 3,
);

async function main(): Promise<void> {
  const chronik = await createChronik('closest');
  const desk = await loadMintWallet(chronik);
  console.log('desk', mintWalletSummary(desk));
  await desk.wallet.sync();
  const deskPure = pureXecBalance(desk.wallet.utxos);
  console.log(`desk pure XEC: ${Number(deskPure) / 100} (${deskPure} sats)`);

  const tips: {
    i: number;
    tip: Awaited<ReturnType<typeof loadTipFeeWallet>>;
    bal: bigint;
  }[] = [];
  for (let i = INDEX; i < INDEX + SERVING; i++) {
    const tip = await loadTipFeeWallet(chronik, i);
    await tip.wallet.sync();
    const bal = pureXecBalance(tip.wallet.utxos);
    tips.push({ i, tip, bal });
    console.log(
      'tip fee',
      tipFeeWalletSummary(i, tip),
      `pureXec=${Number(bal) / 100}`,
    );
  }

  const pool = deskPure > DESK_RESERVE_SATS ? deskPure - DESK_RESERVE_SATS : 0n;
  console.log(
    `desk pool above reserve ≈ ${Number(pool) / 100} XEC (reserve ${Number(DESK_RESERVE_SATS) / 100} XEC)`,
  );

  // Sized remint fuels + postage on tips; treasury + burn change stay on desk.
  if (pool > 0n && tips.length > 0) {
    for (const t of tips) {
      await t.tip.wallet.sync();
      const countFuel = () =>
        t.tip.wallet.utxos.filter(
          (u: { token?: unknown; sats: bigint }) =>
            !u.token && isSizedFuelSats(u.sats),
        ).length;
      const countPostage = () =>
        t.tip.wallet.utxos.filter(
          (u: { token?: unknown; sats: bigint }) =>
            !u.token && isBurnPostageSats(u.sats),
        ).length;
      let pairs = Math.min(countFuel(), countPostage());
      const need = Math.max(0, FUELS_PER_TIP - pairs);
      if (need === 0) {
        console.log(`tip ${t.i}: already has ${pairs} remint+postage pairs`);
        continue;
      }
      for (let n = 0; n < need; n++) {
        await desk.wallet.sync();
        const pureNow = pureXecBalance(desk.wallet.utxos);
        const available =
          pureNow > DESK_RESERVE_SATS ? pureNow - DESK_RESERVE_SATS : 0n;
        if (available < OFFERING_PAIR_SATS) {
          console.log(
            `desk pure ${Number(pureNow) / 100} XEC below reserve+pair; stop funding`,
          );
          break;
        }
        if (DRY) {
          console.log(
            `[dry] desk → tip ${t.i}: ${Number(REMINT_FUEL_SATS) / 100}+${Number(BURN_POSTAGE_SATS) / 100} XEC pair (change on desk)`,
          );
          pairs++;
          continue;
        }
        const { sendOfferingPairFromDesk } = await import(
          '../src/mint/peelSizedFuel.js'
        );
        const pair = await sendOfferingPairFromDesk(desk.wallet, t.tip.wallet);
        console.log(
          `desk→tip ${t.i} pair ${pair.txid} ` +
            `${Number(REMINT_FUEL_SATS) / 100}+${Number(BURN_POSTAGE_SATS) / 100} XEC (change on desk)`,
        );
        pairs++;
      }
      await t.tip.wallet.sync();
      console.log(
        `tip ${t.i} pairs ready: ${Math.min(countFuel(), countPostage())} ` +
          `(fuel ${countFuel()}, postage ${countPostage()})`,
      );
    }
  } else {
    console.log('Desk has no spendable surplus above reserve; skipping fund.');
  }

  // Optional ops: reclaim oversized pure XEC stuck on mint → desk.
  // Not used on the offering path (that sweep was swallowing the next fuel).
  for (const t of tips) {
    await t.tip.wallet.sync();
    if (!pickSplitSourceUtxo(t.tip.wallet.utxos)) continue;
    if (DRY) {
      console.log(`[dry] tip ${t.i}: would reclaim oversized → desk`);
      continue;
    }
    const { peelSizedFuel } = await import('../src/mint/peelSizedFuel.js');
    const txid = await peelSizedFuel(t.tip.wallet, {
      fuelScript: t.tip.wallet.script,
      changeScript: desk.wallet.script,
    });
    if (txid) {
      console.log(`tip ${t.i} reclaim ${txid}: fuel on tip, change → desk`);
    }
  }

  console.log(DRY ? 'Dry-run complete.' : 'Tip fee wallets funded.');
}

main().catch(e => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
