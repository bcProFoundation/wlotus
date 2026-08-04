import type { StatusOk } from './offerApi.js';
import { HUNGRY_GHOST_PROFILE_ID } from './config.js';

/** Prefer mint-api status; fall back to baked Vite profile id for deep links. */
export function hungryGhostProfileId(status?: StatusOk | null): string | null {
  const fromApi = status?.hungryGhost?.profileId?.trim().toLowerCase();
  if (fromApi && /^[0-9a-f]{64}$/.test(fromApi)) return fromApi;
  const baked = HUNGRY_GHOST_PROFILE_ID.trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(baked) ? baked : null;
}

export function isHungryGhostCungTarget(
  parentBurnTxid: string | undefined | null,
  status?: StatusOk | null,
): boolean {
  const profile = hungryGhostProfileId(status);
  if (!profile) return false;
  const parent = (parentBurnTxid ?? '').trim().toLowerCase();
  return parent === profile;
}

/** Server says the festival window is open (do not trust client clock). */
export function isHungryGhostCungActive(status?: StatusOk | null): boolean {
  return status?.hungryGhost?.enabled === true && status?.hungryGhost?.active === true;
}

export function shouldUseCungCopy(
  parentBurnTxid: string | undefined | null,
  status?: StatusOk | null,
): boolean {
  return isHungryGhostCungTarget(parentBurnTxid, status) && isHungryGhostCungActive(status);
}
