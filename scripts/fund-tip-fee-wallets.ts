/**
 * Equally fund per-tip fee wallets from the main mint desk.
 *
 * Remint has no change out — tip wallets must hold small sized fuel coins.
 * This script:
 *   1. Derives tip HD accounts from MINT_MNEMONIC (account tipIndex+1)
 *   2. Splits pure XEC on the desk equally across served tips
 *   3. On each tip wallet, peels REMINT_FUEL_SATS coins for remints
 *
 * Usage (Contabo or local):
 *   MINT_MNEMONIC="…" MINT_SERVING_TIP_COUNT=1 npm run fund-tip-fee-wallets
 *
 * Dry-run (addresses + balances only):
 *   FUND_DRY_RUN=1 MINT_MNEMONIC="…" npm run fund-tip-fee-wallets
 */
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { payment } from 'ecash-lib';
import { createChronik } from '../src/network/createChronik.js';
import { loadMintWallet, mintWalletSummary } from '../src/mint/loadMintWallet.js';
import {
  loadTipFeeWallet,
  tipFeeWalletSummary,
} from '../src/mint/loadTipFeeWallet.js';
import {
  REMINT_FUEL_SATS,
  REMINT_FUEL_SPLIT_MIN_SATS,
  isSizedFuelSats,
  pickSplitSourceUtxo,
  pureXecBalance,
} from '../src/mint/fuelUtxo.js';

loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: '/etc/wlotus/mint.env', override: true });

const SERVING = Math.max(
  1,
  Number(process.env.MINT_SERVING_TIP_COUNT?.trim() || 1) || 1,
);
const DRY = /^(1|true|yes)$/i.test(process.env.FUND_DRY_RUN?.trim() || '');
/** Keep this much pure XEC on the desk after equal split (sats). */
const DESK_RESERVE_SATS = BigInt(
  process.env.MINT_DESK_RESERVE_SATS?.trim() || '10000',
);
/** How many sized fuel coins to try to leave on each tip after funding. */
const FUELS_PER_TIP = Math.max(
  1,
  Number(process.env.MINT_FUELS_PER_TIP?.trim() || 3) || 3,
);

async function splitSizedFuels(
  tipIndex: number,
  wallet: Awaited<ReturnType<typeof loadTipFeeWallet>>['wallet'],
  want: number,
): Promise<number> {
  let made = 0;
  for (let i = 0; i < want; i++) {
    await wallet.sync();
    const sized = wallet.utxos.filter(
      (u: { token?: unknown; sats: bigint }) =>
        !u.token && isSizedFuelSats(u.sats),
    ).length;
    if (sized >= want) break;
    const big = pickSplitSourceUtxo(wallet.utxos);
    if (!big) break;
    if (DRY) {
      console.log(
        `[dry] tip ${tipIndex}: would split ${big.sats} → ${REMINT_FUEL_SATS}`,
      );
      made++;
      break;
    }
    const action: payment.Action = {
      outputs: [{ sats: REMINT_FUEL_SATS, script: wallet.script }],
    };
    const resp = await wallet.action(action).build().broadcast();
    if (!resp.success || !resp.broadcasted?.length) {
      throw new Error(
        `Tip ${tipIndex} fuel split failed: ${JSON.stringify(resp)}`,
      );
    }
    console.log(
      `tip ${tipIndex}: split fuel tx ${resp.broadcasted[0]} (${REMINT_FUEL_SATS} sats)`,
    );
    made++;
    await wallet.sync();
  }
  return made;
}

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
  for (let i = 0; i < SERVING; i++) {
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

  const tipBals = tips.map(t => t.bal);
  const totalTip = tipBals.reduce((a, b) => a + b, 0n);
  const pool = deskPure > DESK_RESERVE_SATS ? deskPure - DESK_RESERVE_SATS : 0n;
  const targetEach =
    tips.length === 0
      ? 0n
      : (totalTip + pool) / BigInt(tips.length);

  console.log(
    `equalize target ≈ ${Number(targetEach) / 100} XEC per tip (reserve ${Number(DESK_RESERVE_SATS) / 100} XEC on desk)`,
  );

  if (pool > 0n && tips.length > 0) {
    // Send from desk so each tip reaches targetEach (as equal as integer sats allow).
    const sends: { tipIndex: number; sats: bigint }[] = [];
    let remaining = pool;
    for (const t of tips) {
      const need = targetEach > t.bal ? targetEach - t.bal : 0n;
      const give = need < remaining ? need : remaining;
      if (give >= REMINT_FUEL_SATS) {
        sends.push({ tipIndex: t.i, sats: give });
        remaining -= give;
      }
    }
    // Dust remainder: dump equally in REMINT_FUEL chunks if any tip still short.
    if (sends.length === 0 && pool >= REMINT_FUEL_SATS) {
      const each = pool / BigInt(tips.length);
      for (const t of tips) {
        if (each >= REMINT_FUEL_SATS) {
          sends.push({ tipIndex: t.i, sats: each });
        }
      }
    }

    if (sends.length === 0) {
      console.log('Nothing to send from desk (tips already funded or pool too small).');
    } else if (DRY) {
      for (const s of sends) {
        console.log(
          `[dry] desk → tip ${s.tipIndex}: ${Number(s.sats) / 100} XEC`,
        );
      }
    } else {
      const outputs = sends.map(s => {
        const tip = tips.find(t => t.i === s.tipIndex)!;
        return { sats: s.sats, script: tip.tip.wallet.script };
      });
      const action: payment.Action = { outputs };
      const resp = await desk.wallet.action(action).build().broadcast();
      if (!resp.success || !resp.broadcasted?.length) {
        throw new Error(`Desk fund failed: ${JSON.stringify(resp)}`);
      }
      console.log(`desk fund tx ${resp.broadcasted[0]} → tips ${sends.map(s => s.tipIndex).join(',')}`);
      await desk.wallet.sync();
      for (const t of tips) await t.tip.wallet.sync();
    }
  } else {
    console.log('Desk has no spendable surplus above reserve; skipping equal fund.');
  }

  for (const t of tips) {
    await t.tip.wallet.sync();
    const bal = pureXecBalance(t.tip.wallet.utxos);
    const sized = t.tip.wallet.utxos.filter(
      (u: { token?: unknown; sats: bigint }) =>
        !u.token && isSizedFuelSats(u.sats),
    ).length;
    console.log(
      `tip ${t.i} after fund: pure=${Number(bal) / 100} XEC sizedFuels=${sized}`,
    );
    if (bal >= REMINT_FUEL_SPLIT_MIN_SATS || sized < FUELS_PER_TIP) {
      await splitSizedFuels(t.i, t.tip.wallet, FUELS_PER_TIP);
    }
    await t.tip.wallet.sync();
    const sized2 = t.tip.wallet.utxos.filter(
      (u: { token?: unknown; sats: bigint }) =>
        !u.token && isSizedFuelSats(u.sats),
    ).length;
    console.log(`tip ${t.i} sized fuels ready: ${sized2}`);
  }

  console.log(DRY ? 'Dry-run complete.' : 'Tip fee wallets funded.');
}

main().catch(e => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
