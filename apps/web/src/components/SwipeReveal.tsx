import {
  useEffect,
  useRef,
  type ReactNode,
} from 'react';

const ACTION_WIDTH = 88;
const AXIS_SLOP = 8;

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      'button, a, input, textarea, select, label, [role="button"]',
    ),
  );
}

/**
 * Swipe / drag left to reveal a destructive action.
 *
 * - iOS Safari: native touch listeners with `{ passive: false }` so horizontal
 *   `preventDefault` actually runs (React pointer events are often passive).
 * - Desktop: do not capture the pointer until a horizontal drag is confirmed,
 *   and ignore presses that start on buttons/links so clicks still work.
 */
export function SwipeReveal(props: {
  children: ReactNode;
  actionLabel: string;
  onAction: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
}) {
  const { children, actionLabel, onAction, open, onOpenChange, disabled } =
    props;
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  const onOpenChangeRef = useRef(onOpenChange);
  const disabledRef = useRef(disabled);
  const offsetRef = useRef(open ? -ACTION_WIDTH : 0);
  const draggingRef = useRef(false);

  openRef.current = open;
  onOpenChangeRef.current = onOpenChange;
  disabledRef.current = disabled;

  const applyOffset = (px: number) => {
    const clamped = Math.max(-ACTION_WIDTH, Math.min(0, px));
    offsetRef.current = clamped;
    const track = trackRef.current;
    if (track) track.style.transform = `translate3d(${clamped}px,0,0)`;
  };

  const setDraggingClass = (on: boolean) => {
    draggingRef.current = on;
    rootRef.current?.classList.toggle('is-dragging', on);
  };

  // Keep transform in sync when parent toggles open (other row, remove, etc.).
  useEffect(() => {
    if (draggingRef.current) return;
    applyOffset(open ? -ACTION_WIDTH : 0);
  }, [open]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let startX = 0;
    let startY = 0;
    let startOffset = 0;
    let axis: 'x' | 'y' | null = null;
    let active = false;
    let pointerId: number | null = null;

    const finishHorizontal = () => {
      const shouldOpen = offsetRef.current < -ACTION_WIDTH * 0.4;
      onOpenChangeRef.current(shouldOpen);
      applyOffset(shouldOpen ? -ACTION_WIDTH : 0);
    };

    const endGesture = (wasHorizontal: boolean) => {
      setDraggingClass(false);
      active = false;
      const finishedAxis = axis;
      axis = null;
      pointerId = null;
      if (wasHorizontal || finishedAxis === 'x') finishHorizontal();
    };

    const begin = (x: number, y: number) => {
      active = true;
      axis = null;
      startX = x;
      startY = y;
      startOffset = offsetRef.current;
    };

    const move = (x: number, y: number, ev: Event) => {
      if (!active) return false;
      const dx = x - startX;
      const dy = y - startY;
      if (axis == null) {
        if (Math.abs(dx) < AXIS_SLOP && Math.abs(dy) < AXIS_SLOP) return false;
        // Prefer vertical slightly so page scroll wins on diagonal flicks.
        axis = Math.abs(dx) > Math.abs(dy) * 1.15 ? 'x' : 'y';
        if (axis === 'y') {
          active = false;
          return false;
        }
        setDraggingClass(true);
      }
      if (axis !== 'x') return false;
      if (ev.cancelable) ev.preventDefault();
      applyOffset(startOffset + dx);
      return true;
    };

    // ——— Touch (iPhone Safari) ———
    const onTouchStart = (e: TouchEvent) => {
      if (disabledRef.current || e.touches.length !== 1) return;
      if (isInteractiveTarget(e.target)) return;
      const t = e.touches[0]!;
      begin(t.clientX, t.clientY);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!active || e.touches.length !== 1) return;
      const t = e.touches[0]!;
      move(t.clientX, t.clientY, e);
    };

    const onTouchEnd = () => {
      if (!active && axis !== 'x') {
        active = false;
        axis = null;
        return;
      }
      endGesture(axis === 'x');
    };

    // ——— Mouse / pen (desktop) ———
    // Touch is handled above; skip pointerType === 'touch' to avoid double-handling.
    const onPointerDown = (e: PointerEvent) => {
      if (disabledRef.current) return;
      if (e.pointerType === 'touch') return;
      if (e.button !== 0) return;
      if (isInteractiveTarget(e.target)) return;
      pointerId = e.pointerId;
      begin(e.clientX, e.clientY);
      // Do NOT setPointerCapture yet — that breaks button clicks on desktop.
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!active || e.pointerType === 'touch') return;
      if (pointerId != null && e.pointerId !== pointerId) return;
      const horizontal = move(e.clientX, e.clientY, e);
      if (horizontal && axis === 'x' && !track.hasPointerCapture(e.pointerId)) {
        try {
          track.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      if (pointerId != null && e.pointerId !== pointerId) return;
      if (!active && axis !== 'x') {
        active = false;
        axis = null;
        pointerId = null;
        return;
      }
      if (track.hasPointerCapture(e.pointerId)) {
        try {
          track.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
      endGesture(axis === 'x');
    };

    track.addEventListener('touchstart', onTouchStart, { passive: true });
    // Critical for iOS: must be non-passive so preventDefault stops vertical scroll.
    track.addEventListener('touchmove', onTouchMove, { passive: false });
    track.addEventListener('touchend', onTouchEnd);
    track.addEventListener('touchcancel', onTouchEnd);
    track.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    return () => {
      track.removeEventListener('touchstart', onTouchStart);
      track.removeEventListener('touchmove', onTouchMove);
      track.removeEventListener('touchend', onTouchEnd);
      track.removeEventListener('touchcancel', onTouchEnd);
      track.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`swipe-reveal${open ? ' is-open' : ''}`}
    >
      <button
        type="button"
        className="swipe-reveal-action"
        tabIndex={open ? 0 : -1}
        aria-hidden={!open}
        onClick={() => {
          onOpenChange(false);
          onAction();
        }}
      >
        {actionLabel}
      </button>
      <div
        ref={trackRef}
        className="swipe-reveal-track"
        style={{ transform: `translate3d(${open ? -ACTION_WIDTH : 0}px,0,0)` }}
      >
        {children}
      </div>
    </div>
  );
}
