import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * True when pull-to-refresh should not run: body scroll locked (modals /
 * offer session) or the gesture started inside a dialog.
 */
function pullBlocked(target: EventTarget | null): boolean {
  if (document.body.style.overflow === 'hidden') return true;
  if (document.querySelector('.offer-modal')) return true;
  if (target instanceof Element && target.closest('.offer-modal')) return true;
  return false;
}

/**
 * Mobile pull-to-refresh: at scroll top, drag down to reload (and poke the SW).
 */
export function PullToRefresh(props: { children: ReactNode }) {
  const startY = useRef<number | null>(null);
  const pulling = useRef(false);
  const [offset, setOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const threshold = 72;

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (refreshing || pullBlocked(e.target)) {
      startY.current = null;
      pulling.current = false;
      return;
    }
    if (window.scrollY > 2) {
      startY.current = null;
      return;
    }
    startY.current = e.touches[0]?.clientY ?? null;
    pulling.current = true;
  }, [refreshing]);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (!pulling.current || startY.current == null || refreshing) return;
    if (pullBlocked(e.target)) {
      startY.current = null;
      pulling.current = false;
      setOffset(0);
      return;
    }
    if (window.scrollY > 2) {
      startY.current = null;
      setOffset(0);
      return;
    }
    const y = e.touches[0]?.clientY ?? startY.current;
    const dy = Math.max(0, y - startY.current);
    if (dy > 8) {
      // Prevent browser native overscroll bounce fighting us
      if (e.cancelable) e.preventDefault();
      setOffset(Math.min(dy * 0.45, 96));
    }
  }, [refreshing]);

  const onTouchEnd = useCallback(() => {
    if (!pulling.current) return;
    pulling.current = false;
    startY.current = null;
    setOffset(current => {
      if (current >= threshold && !refreshing) {
        // Re-check: modal may have opened mid-gesture.
        if (pullBlocked(null)) return 0;
        setRefreshing(true);
        const w = window as Window & {
          __wlotusUpdateSW?: (reloadPage?: boolean) => Promise<void>;
        };
        void (async () => {
          try {
            await w.__wlotusUpdateSW?.(true);
          } catch {
            /* ignore */
          }
          window.location.reload();
        })();
      }
      return 0;
    });
  }, [refreshing, threshold]);

  useEffect(() => {
    const opts: AddEventListenerOptions = { passive: false };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, opts);
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [onTouchStart, onTouchMove, onTouchEnd]);

  const label =
    refreshing
      ? 'Updating…'
      : offset >= threshold
        ? 'Release to refresh'
        : offset > 12
          ? 'Pull to refresh'
          : null;

  return (
    <>
      <div
        className={`ptr-indicator${offset > 12 || refreshing ? ' visible' : ''}`}
        style={{ height: refreshing ? 40 : offset }}
        aria-hidden={label == null}
      >
        {label}
      </div>
      {props.children}
    </>
  );
}
