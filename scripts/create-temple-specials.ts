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
 * Funding (same test + prod path):
 *   1. Prefer existing desk/tip inventory (1 atom per root).
 *   2. If short, auto-remint once via MooreTipTemple (tip fee wallet = miner)
 *      so ~102 miner atoms land on the tip, then burn the roots.
 *   Disable auto-remint with CREATE_TEMPLE_SPECIALS_NO_MINT=1.
 *
 * Kinds / windows:
 *   - Vu Lan  → kind "event", full civil day of lunar 15/7
 *   - Cô Hồn  → kind "ghost", lunar 2/7 00:00 → 15/7 12:00 local
 *     (JSON: eventStart, eventEnd, eventEndHour=12)
 *
 * On-chain note is kept short (ALP BURN + DANA ≤ 223 OP_RETURN). Long stories
 * live in templeSpecials defaultTempleStory, not the root burn.
 *
 * Usage (Contabo / local with mint.env):
 *   set -a && source /etc/wlotus/mint.env && set +a
 *   npm run create-temple-specials
 *
 * Dry-run (encode + plan, no broadcast):
 *   CREATE_TEMPLE_SPECIALS_DRY_RUN=1 npm run create-temple-specials
 *
 * Optional env:
 *   TOKEN_ID                 — else from deployments/*-wlotus.json matching id
 *   MINT_MNEMONIC            — desk phrase (tip HD wallets; required for remint)
 *   MINT_SERVING_TIP_COUNT   — tip accounts to scan (default 28)
 *   BATON_INDEX              — baton tip to remint (default 0)
 *   EVENT_LUNAR_YMD          — peak day, default 2026-07-15
 *   EVENT_LUNAR_START        — Cô Hồn start, default 2026-07-02
 *   EVENT_YEAR               — year for those defaults
 *   CREATE_TEMPLE_SPECIALS_NO_MINT=1  — never auto-remint
 *   CREATE_TEMPLE_SPECIALS_NO_RESTART=1 — skip mint-api restart after tip advance
 *   MINT_API_SERVICE                  — systemd unit (default wlotus-mint-api)
 *
 * After auto-remint the script writes tipLocktime/powAddress/lastRemintTxid into
 * every deployments/*-wlotus*.json that shares the same tokenId (so loadDep
 * order cannot leave mint-api on a spent P2SH), then restarts mint-api so the
 * running process picks up the new tip.
 */

import { resolve } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { config as loadEnv } from 'dotenv';
import type { Wallet } from 'ecash-wallet';
import { fromHex, toHex } from 'ecash-lib';
import { createChronik } from '../src/network/createChronik.js';
import { getMedianTimePast } from '../src/network/medianTimePast.js';
import { loadTipFeeWallet } from '../src/mint/loadTipFeeWallet.js';
import { loadMintWallet } from '../src/mint/loadMintWallet.js';
import {
  REMINT_FUEL_SATS,
  pickSizedFuelUtxo,
} from '../src/mint/fuelUtxo.js';
import { peelSizedFuel } from '../src/mint/peelSizedFuel.js';
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
import { createPowRemintMooreTipTempleContract } from '../src/covenant/powRemintMooreTipTempleScript.js';
import {
  buildMinedMooreTipTempleRemintTx,
  mooreTipTempleMinerBanner,
} from '../src/miner/remintMooreTipTemple.js';
import { WLOTUS_MINER_ATOMS } from '../src/params/wlotusMint.js';

loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: '/etc/wlotus/mint.env', override: true });

const DRY = /^(1|true|yes)$/i.test(
  process.env.CREATE_TEMPLE_SPECIALS_DRY_RUN?.trim() || '',
);
const NO_MINT = /^(1|true|yes)$/i.test(
  process.env.CREATE_TEMPLE_SPECIALS_NO_MINT?.trim() || '',
);
const NO_RESTART = /^(1|true|yes)$/i.test(
  process.env.CREATE_TEMPLE_SPECIALS_NO_RESTART?.trim() || '',
);
const MINT_API_SERVICE =
  process.env.MINT_API_SERVICE?.trim() || 'wlotus-mint-api';
