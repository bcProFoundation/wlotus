/**
 * Defer PWA reload while an offering (mine / remint / burn) is in flight.
 * A mid-session controllerchange reload would abort PoW and lose the burn.
 */

export type PwaReloadAction = 'reload' | 'check' | 'noop';

export type PwaReloadGate = {
  setOffering: (active: boolean) => void;
  onControllerChange: () => PwaReloadAction;
  onCheck: () => PwaReloadAction;
  isOffering: () => boolean;
};

export function createPwaReloadGate(): PwaReloadGate {
  let offering = false;
  let pendingReload = false;

  return {
    setOffering(active: boolean) {
      offering = active;
    },
    onControllerChange() {
      if (offering) {
        pendingReload = true;
        return 'noop';
      }
      return 'reload';
    },
    onCheck() {
      if (offering) return 'noop';
      if (pendingReload) {
        pendingReload = false;
        return 'reload';
      }
      return 'check';
    },
    isOffering() {
      return offering;
    },
  };
}

export const pwaReloadGate = createPwaReloadGate();

export function setOfferingBlocksPwaReload(active: boolean): void {
  pwaReloadGate.setOffering(active);
}
