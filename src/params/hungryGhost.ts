/**
 * @deprecated Prefer `templeSpecials.ts` — Hungry Ghost is one kind of temple special.
 * Re-exports kept so existing imports/tests keep working.
 */

export {
  addCalendarDays,
  globalCivilDayWindowUtc,
  isWithinGlobalCivilDay,
  parseYmd,
  burnAtomsForDeskKeep,
  DEFAULT_SPECIAL_DESK_KEEP,
  NORMAL_FLOWER_BURN_ATOMS,
  type TempleSpecial,
  type TempleSpecialKind,
  type TempleSpecialPublic,
  type TempleSpecialsPublicStatus,
} from './templeSpecials.js';

import {
  burnAtomsForDeskKeep,
  effectiveEventDate,
  isActiveSpecialOffer,
  loadTempleSpecialsFromEnv,
  resolveOfferBurnAtoms,
  resolveTempleSpecialsStatus,
  type TempleSpecial,
  type TempleSpecialsPublicStatus,
} from './templeSpecials.js';
import { WLOTUS_MINER_ATOMS } from './wlotusMint.js';

/** @deprecated use TempleSpecial */
export interface HungryGhostConfig {
  profileId: string;
  deadDate: string;
  testOffsetDays: number;
  deskKeep?: number;
}

/** @deprecated use TempleSpecialPublic / TempleSpecialsPublicStatus */
export interface HungryGhostPublicStatus {
  enabled: boolean;
  active: boolean;
  profileId: string | null;
  effectiveDeadDate: string | null;
  deadDate: string | null;
  testOffsetDays: number;
  burnAtoms: string;
  deskKeep: number;
  serverNow: string;
  windowStartUtc: string | null;
  windowEndUtc: string | null;
}

export const HUNGRY_GHOST_NAME_VI = 'Cô Hồn';
export const HUNGRY_GHOST_NAME_EN = 'Hungry Ghost';
export const HUNGRY_GHOST_NAME_ZH = '孤魂';
export const HUNGRY_GHOST_BURN_ATOMS = WLOTUS_MINER_ATOMS;

export function loadHungryGhostConfigFromEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): HungryGhostConfig {
  const specials = loadTempleSpecialsFromEnv(env);
  const ghost = specials.find(s => s.kind === 'ghost') ?? specials[0];
  if (!ghost) {
    return { profileId: '', deadDate: '', testOffsetDays: 0, deskKeep: 6 };
  }
  return {
    profileId: ghost.profileId,
    deadDate: ghost.eventDate,
    testOffsetDays: ghost.testOffsetDays,
    deskKeep: ghost.deskKeep,
  };
}

export function effectiveHungryGhostDeadDate(cfg: HungryGhostConfig): string | null {
  return effectiveEventDate({
    eventDate: cfg.deadDate,
    testOffsetDays: cfg.testOffsetDays,
  });
}

export function resolveHungryGhostStatus(
  cfg: HungryGhostConfig,
  nowMs = Date.now(),
): HungryGhostPublicStatus {
  const special: TempleSpecial = {
    profileId: cfg.profileId,
    kind: 'ghost',
    eventDate: cfg.deadDate,
    deskKeep: cfg.deskKeep ?? 6,
    testOffsetDays: cfg.testOffsetDays,
    name: HUNGRY_GHOST_NAME_VI,
  };
  const st = resolveTempleSpecialsStatus([special], nowMs);
  const p = st.profiles[0];
  return {
    enabled: st.enabled,
    active: p?.active === true,
    profileId: p?.profileId ?? (cfg.profileId || null),
    effectiveDeadDate: p?.effectiveEventDate ?? null,
    deadDate: p?.eventDate ?? null,
    testOffsetDays: cfg.testOffsetDays,
    burnAtoms: p?.burnAtoms ?? burnAtomsForDeskKeep(cfg.deskKeep ?? 6).toString(),
    deskKeep: p?.deskKeep ?? (cfg.deskKeep ?? 6),
    serverNow: st.serverNow,
    windowStartUtc: p?.windowStartUtc ?? null,
    windowEndUtc: p?.windowEndUtc ?? null,
  };
}

/** @deprecated use isActiveSpecialOffer — outside window is still offerable (1 flower). */
export function isHungryGhostSpecialOffer(opts: {
  parentBurnTxid?: string;
  cfg?: HungryGhostConfig;
  nowMs?: number;
}): boolean {
  if (opts.cfg) {
    const special: TempleSpecial = {
      profileId: opts.cfg.profileId,
      kind: 'ghost',
      eventDate: opts.cfg.deadDate,
      deskKeep: opts.cfg.deskKeep ?? 6,
      testOffsetDays: opts.cfg.testOffsetDays,
    };
    return isActiveSpecialOffer({
      parentBurnTxid: opts.parentBurnTxid,
      specials: [special],
      nowMs: opts.nowMs,
    });
  }
  return isActiveSpecialOffer({
    parentBurnTxid: opts.parentBurnTxid,
    nowMs: opts.nowMs,
  });
}

export { resolveOfferBurnAtoms, resolveTempleSpecialsStatus, isActiveSpecialOffer };
