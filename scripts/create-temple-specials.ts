#!/usr/bin/env tsx
/**
 * Create on-chain root altars for temple public specials (Vu Lan + Cô Hồn),
 * then print the TEMPLE_SPECIALS_JSON snippet to register them.
 *
 * Why on-chain first (not JSON-only):
 *   - dana-index / search only see real DANA memorial burns
 *   - re-offers need a real parentBurnTxid (root)
 *   - temple specials only raise the burn amount for a registered profileId
 *
 * Who pays the first burn:
 *   Desk/temple inventory. After each sponsored remint the tip fee wallet holds
 *   the miner share; burning 1 for a normal flower leaves ~101 inventory on that
 *   tip. This script spends 1 atom per special from that inventory (no new remint).
 *
 * Kinds:
 *   - Vu Lan  → kind "event" (popup: Vu Lan Báo Hiếu, button: Dâng Hoa)
 *   - Cô Hồn  → kind "ghost" (button: Cúng)
 *
 * Product windows (server still single-day around eventDate until range lands):
 *   - Cô Hồn: lunar 2/7 00:00 → 15/7 12:00 local
 *   - Vu Lan: full civil day of lunar 15/7
 * 2026: lunar 15/7 = solar 27 Aug; launch 00:00 UTC+14 that day = 17:00 VN 26 Aug.
 *
 * Usage (Contabo / local with mint.env):
 *   set -a && source /etc/wlotus/mint.env && set +a
 *   npm run create-temple-specials
 *
 * Dry-run (encode + find inventory, no broadcast):
 *   CREATE_TEMPLE_SPECIALS_DRY_RUN=1 npm run create-temple-specials
 *
 * Optional env:
 *   TOKEN_ID                 — else from deployments/mainnet-*.json
 *   MINT_MNEMONIC            — desk phrase (required for tip HD wallets)
 *   MINT_SERVING_TIP_COUNT   — how many tip accounts to scan (default 28)
 *   EVENT_LUNAR_YMD          — default 2026-07-15 (15/7 âm lịch)
 *   EVENT_YEAR               — override year part of EVENT_LUNAR_YMD
 */
import { resolve } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import type { Wallet } from 'ecash-wallet';
import { createChronik } from '../src/network/createChronik.js';
import { loadTipFeeWallet } from '../src/mint/loadTipFeeWallet.js';
import { loadMintWallet } from '../src/mint/loadMintWallet.js';
import {
  burnOnePrayer,
  OFFERING_ID_WLOTUS,
} from '../src/offering/burnPrayer.js';
import {
  encodeAltarNote,
  emptyAltarFields,
  type AltarFields,
} from '../src/offering/altarFields.js';
import { lunarYmdToSolarYmd } from '../src/lib/lunarCalendar.js';

loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: '/etc/wlotus/mint.env', override: true });

const DRY = /^(1|true|yes)$/i.test(
  process.env.CREATE_TEMPLE_SPECIALS_DRY_RUN?.trim() || '',
);

interface SpecialSpec {
  /** JSON registry name */
  name: string;
  kind: 'ghost' | 'hero' | 'event';
  /** On-chain altar name */
  altarName: string;
  /** Remembrance note (optional) */
  note: string;
  eventDate: string;
  eventCalendar: 'lunar' | 'solar';
}

function loadTokenId(): string {
  const env = process.env.TOKEN_ID?.trim();
  if (env && /^[0-9a-fA-F]{64}$/.test(env)) return env.toLowerCase();
  for (const rel of [
    'deployments/mainnet-wlotus.json',
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
  throw new Error(
    'Set TOKEN_ID or create deployments/mainnet-wlotus.json (or dryrun)',
  );
}

function defaultSpecs(): SpecialSpec[] {
  const year = process.env.EVENT_YEAR?.trim() || '2026';
  const lunarYmd =
    process.env.EVENT_LUNAR_YMD?.trim() || `${year}-07-15`; // 15/7 âm lịch
  return [
    {
      name: 'Vu Lan',
      kind: 'event',
      altarName: 'Vu Lan',
      note:
        'Lễ Vu Lan — báo hiếu, tưởng nhớ ông bà cha mẹ. Hoa sen tưởng niệm vĩnh hằng.',
      eventDate: lunarYmd,
      eventCalendar: 'lunar',
    },
    {
      name: 'Cô Hồn',
      kind: 'ghost',
      altarName: 'Cô Hồn',
      note:
        'Cúng Cô Hồn — cầu siêu cho hương linh không nơi nương tựa trong tháng bảy.',
      eventDate: lunarYmd,
      eventCalendar: 'lunar',
    },
  ];
}

/** Solar YYYY-MM-DD for altar deathDate (must be set so the root is re-offerable). */
function deathDateForSpec(spec: SpecialSpec): string {
  if (spec.eventCalendar === 'solar') return spec.eventDate;
  const solar = lunarYmdToSolarYmd(spec.eventDate, 7, false);
  if (!solar) {
    throw new Error(
      `Cannot convert lunar eventDate ${spec.eventDate} → solar for deathDate`,
    );
  }
  return solar;
}

function buildAltarNote(spec: SpecialSpec): string {
  const fields: AltarFields = {
    ...emptyAltarFields(),
    name: spec.altarName,
    note: spec.note,
    // Collective festival memorials: deathDate = solar event day so re-offers work.
    deathDate: deathDateForSpec(spec),
  };
  return encodeAltarNote(fields);
}

interface TokenHolder {
  label: string;
  tipIndex: number | null;
  wallet: Wallet;
  atoms: bigint;
}

async function findInventory(
  chronik: Awaited<ReturnType<typeof createChronik>>,
  tokenId: string,
  needAtoms: bigint,
): Promise<TokenHolder> {
  const tipCount = Math.max(
    1,
    Math.min(
      28,
      Math.floor(
        Number(process.env.MINT_SERVING_TIP_COUNT?.trim() || '28') || 28,
      ),
    ),
  );

  const holders: TokenHolder[] = [];

  // Tip fee wallets hold miner-share inventory after sponsored remints.
  if (process.env.MINT_MNEMONIC?.trim()) {
    for (let i = 0; i < tipCount; i++) {
      try {
        const tip = await loadTipFeeWallet(chronik, i);
        const atoms = tip.wallet.utxos
          .filter(
            u =>
              u.token?.tokenId === tokenId &&
              !u.token?.isMintBaton &&
              u.token.atoms != null,
          )
          .reduce((s, u) => s + BigInt(u.token!.atoms!), 0n);
        if (atoms > 0n) {
          holders.push({
            label: `tip-${i}`,
            tipIndex: i,
            wallet: tip.wallet,
            atoms,
          });
        }
      } catch {
        /* skip tips that cannot be derived */
      }
    }
  }

  // Desk single address (legacy / consolidated inventory).
  try {
    const desk = await loadMintWallet(chronik);
    const atoms = desk.wallet.utxos
      .filter(
        u =>
          u.token?.tokenId === tokenId &&
          !u.token?.isMintBaton &&
          u.token.atoms != null,
      )
      .reduce((s, u) => s + BigInt(u.token!.atoms!), 0n);
    if (atoms > 0n) {
      holders.push({
        label: 'desk',
        tipIndex: null,
        wallet: desk.wallet,
        atoms,
      });
    }
  } catch {
    /* no desk key */
  }

  holders.sort((a, b) => (a.atoms < b.atoms ? 1 : a.atoms > b.atoms ? -1 : 0));
  const total = holders.reduce((s, h) => s + h.atoms, 0n);
  console.log(
    JSON.stringify(
      {
        inventoryScan: holders.map(h => ({
          label: h.label,
          atoms: h.atoms.toString(),
        })),
        totalAtoms: total.toString(),
        needAtoms: needAtoms.toString(),
      },
      null,
      2,
    ),
  );

  const pick = holders.find(h => h.atoms >= needAtoms);
  if (!pick) {
    throw new Error(
      `Need ≥ ${needAtoms} inventory atoms on desk/tip wallets (found ${total}). ` +
        'Run sponsored offerings (or abandon pending burns) so tip fee wallets accumulate miner-share inventory, then retry.',
    );
  }
  return pick;
}

async function main(): Promise<void> {
  const tokenId = loadTokenId();
  const specs = defaultSpecs();
  const needAtoms = BigInt(specs.length); // 1 flower per root

  console.log(
    JSON.stringify(
      {
        dryRun: DRY,
        tokenId,
        specials: specs.map(s => ({
          name: s.name,
          kind: s.kind,
          eventDate: s.eventDate,
          eventCalendar: s.eventCalendar,
          deathDateSolar: deathDateForSpec(s),
        })),
      },
      null,
      2,
    ),
  );

  const chronik = await createChronik('closest');
  const holder = await findInventory(chronik, tokenId, needAtoms);
  console.log(`Using inventory from ${holder.label} (${holder.atoms} atoms)`);

  const created: Array<{
    name: string;
    kind: string;
    eventDate: string;
    eventCalendar: string;
    profileId: string;
    explorer: string;
    notePreview: string;
  }> = [];

  for (const spec of specs) {
    const note = buildAltarNote(spec);
    console.log(
      `\n→ ${spec.name}: noteBytes=${new TextEncoder().encode(note).length}`,
    );

    if (DRY) {
      created.push({
        name: spec.name,
        kind: spec.kind,
        eventDate: spec.eventDate,
        eventCalendar: spec.eventCalendar,
        profileId: '(dry-run — not broadcast)',
        explorer: '',
        notePreview: note.slice(0, 80),
      });
      continue;
    }

    await holder.wallet.sync();
    const { txid } = await burnOnePrayer({
      wallet: holder.wallet,
      tokenId,
      note,
      offeringId: OFFERING_ID_WLOTUS,
      // root dedication — no parent
      burnAtoms: 1n,
    });

    created.push({
      name: spec.name,
      kind: spec.kind,
      eventDate: spec.eventDate,
      eventCalendar: spec.eventCalendar,
      profileId: txid.toLowerCase(),
      explorer: `https://explorer.e.cash/tx/${txid}`,
      notePreview: note.slice(0, 80),
    });
    console.log(`  burnTxid ${txid}`);
  }

  const registry = created
    .filter(c => /^[0-9a-f]{64}$/.test(c.profileId))
    .map(c => ({
      profileId: c.profileId,
      kind: c.kind,
      eventDate: c.eventDate,
      eventCalendar: c.eventCalendar,
      name: c.name,
    }));

  const outDir = resolve(process.cwd(), 'deployments');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, 'temple-specials-created.json');
  const payload = {
    createdAt: new Date().toISOString(),
    dryRun: DRY,
    tokenId,
    inventoryFrom: holder.label,
    created,
    TEMPLE_SPECIALS_JSON: registry,
  };
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);

  console.log('\n=== Result ===');
  console.log(JSON.stringify(payload, null, 2));
  if (!DRY && registry.length > 0) {
    console.log('\nSet on mint-api / Contabo and matching VITE_* for SPA:\n');
    console.log(`TEMPLE_SPECIALS_JSON='${JSON.stringify(registry)}'`);
    console.log(`\nWrote ${outPath}`);
  } else if (DRY) {
    console.log(
      '\nDry-run only — re-run without CREATE_TEMPLE_SPECIALS_DRY_RUN=1 to broadcast.',
    );
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
