/**
 * Optional helper: move ALP inventory from a **P2PKH** desk wallet to cold storage.
 *
 * Launch WLotus temple sink is **P2SH** (covenant `templeScriptHash`) — this script
 * does not spend that address. Use it only for leftover P2PKH inventory or ops desks.
 *
 * Usage:
 *   TOKEN_ID=… COLD_ADDRESS=ecash:q…or p… \
 *     TEMPLE_SK_HEX=… npm run sweep-temple-to-cold
 *
 *   # or mnemonic:
 *   TOKEN_ID=… COLD_ADDRESS=… TEMPLE_MNEMONIC="…" npm run sweep-temple-to-cold
 *
 * Dry-run (no broadcast):
 *   SWEEP_DRY_RUN=1 … npm run sweep-temple-to-cold
 *
 * Optional: deployments/mainnet-dryrun-wlotus.json supplies TOKEN_ID if unset.
 */
import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import { Wallet } from 'ecash-wallet';
import {
  Address,
  ALP_TOKEN_TYPE_STANDARD,
  DEFAULT_DUST_SATS,
  fromHex,
  payment,
  toHex,
} from 'ecash-lib';
import { createChronik } from '../src/network/createChronik.js';

loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: '/etc/wlotus/mint.env', override: true });

const DRY = /^(1|true|yes)$/i.test(process.env.SWEEP_DRY_RUN?.trim() || '');
/** Keep this much pure XEC on hot for fees (sats). */
const HOT_XEC_RESERVE_SATS = BigInt(
  process.env.TEMPLE_HOT_XEC_RESERVE_SATS?.trim() || '5000',
);

function loadTokenId(): string {
  const env = process.env.TOKEN_ID?.trim();
  if (env && /^[0-9a-fA-F]{64}$/.test(env)) return env.toLowerCase();
  for (const rel of [
    'deployments/mainnet-dryrun-wlotus.json',
    'deployments/mainnet-dryrun-active.json',
  ]) {
    const path = resolve(process.cwd(), rel);
    if (!existsSync(path)) continue;
    const dep = JSON.parse(readFileSync(path, 'utf8')) as { tokenId?: string };
    if (dep.tokenId && /^[0-9a-fA-F]{64}$/.test(dep.tokenId)) {
      return dep.tokenId.toLowerCase();
    }
  }
  throw new Error('Set TOKEN_ID or create deployments/mainnet-dryrun-wlotus.json');
}

async function loadHotWallet(
  chronik: Awaited<ReturnType<typeof createChronik>>,
): Promise<Wallet> {
  const mnemonic =
    process.env.TEMPLE_MNEMONIC?.trim() ||
    process.env.MINT_MNEMONIC?.trim();
  if (mnemonic) {
    const phrase = mnemonic.split(/\s+/).join(' ');
    const words = phrase.split(' ');
    if (words.length !== 12 && words.length !== 24) {
      throw new Error('TEMPLE_MNEMONIC / MINT_MNEMONIC must be 12 or 24 words');
    }
    return Wallet.fromMnemonic(phrase, chronik);
  }
  const skHex =
    process.env.TEMPLE_SK_HEX?.trim() ||
    process.env.GENESIS_SK_HEX?.trim() ||
    process.env.MINT_SK_HEX?.trim();
  if (!skHex || !/^[0-9a-fA-F]{64}$/.test(skHex)) {
    throw new Error(
      'Set TEMPLE_MNEMONIC / MINT_MNEMONIC or TEMPLE_SK_HEX / GENESIS_SK_HEX',
    );
  }
  return Wallet.fromSk(fromHex(skHex), chronik);
}

async function main(): Promise<void> {
  const tokenId = loadTokenId();
  const coldRaw = process.env.COLD_ADDRESS?.trim();
  if (!coldRaw) {
    throw new Error('COLD_ADDRESS required (P2PKH or P2SH cashaddr)');
  }
  const cold = Address.parse(coldRaw);
  const coldScript = cold.toScript();

  const chronik = await createChronik('closest');
  const hot = await loadHotWallet(chronik);
  await hot.sync();

  const tokenUtxos = hot.utxos.filter(
    u => u.token?.tokenId === tokenId && !u.token?.isMintBaton,
  );
  const atoms = tokenUtxos.reduce(
    (sum, u) => sum + (u.token?.atoms ?? 0n),
    0n,
  );
  const pureXec = hot.utxos
    .filter(u => !u.token)
    .reduce((sum, u) => sum + u.sats, 0n);

  console.log(
    JSON.stringify(
      {
        hot: hot.address,
        cold: cold.toString(),
        coldType: cold.type,
        tokenId,
        utxos: tokenUtxos.length,
        atoms: atoms.toString(),
        pureXecSats: pureXec.toString(),
        dryRun: DRY,
      },
      null,
      2,
    ),
  );

  if (atoms === 0n) {
    console.log('Nothing to sweep (0 atoms).');
    return;
  }
  if (pureXec < HOT_XEC_RESERVE_SATS) {
    console.warn(
      `Warning: hot pure XEC ${Number(pureXec) / 100} below reserve ` +
        `${Number(HOT_XEC_RESERVE_SATS) / 100} — send may still work if dust inputs suffice`,
    );
  }

  if (DRY) {
    console.log(
      `[dry] would SEND ${atoms} atoms of ${tokenId.slice(0, 12)}… → ${cold.toString()}`,
    );
    return;
  }

  const action: payment.Action = {
    outputs: [
      { sats: 0n },
      {
        sats: DEFAULT_DUST_SATS,
        script: coldScript,
        tokenId,
        atoms,
        isMintBaton: false,
      },
    ],
    tokenActions: [
      {
        type: 'SEND',
        tokenId,
        tokenType: ALP_TOKEN_TYPE_STANDARD,
      },
    ],
  };
  const resp = await hot.action(action).build().broadcast();
  if (!resp.success || !resp.broadcasted?.length) {
    throw new Error(`Sweep failed: ${JSON.stringify(resp)}`);
  }
  console.log(
    JSON.stringify(
      {
        ok: true,
        txid: resp.broadcasted[0],
        atoms: atoms.toString(),
        explorer: `https://explorer.e.cash/tx/${resp.broadcasted[0]}`,
        note: `Left XEC on hot (pk ${toHex(hot.pk).slice(0, 8)}…) for fees; tokens moved to cold`,
      },
      null,
      2,
    ),
  );
}

main().catch(e => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
