import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

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
    if (refreshing) return;
    if (window.scrollY > 2) {
      startY.current = null;
      return;
    }
    startY.current = e.touches[0]?.clientY ?? null;
    pulling.current = true;
  }, [refreshing]);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (!pulling.current || startY.current == null || refreshing) return;
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
