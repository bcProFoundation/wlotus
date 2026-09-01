import { useEffect, useRef, type ReactNode } from 'react';

/** Width of each swipe action button (px). */
export const SWIPE_ACTION_WIDTH = 76;
const AXIS_SLOP = 8;

export type SwipeAction = {
  key: string;
  label: string;
  /** Destructive styling (e.g. Delete). */
  danger?: boolean;
  onClick: () => void;
};

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      'button, a, input, textarea, select, label, [role="button"]',
    ),
  );
}

/**
 * Swipe / drag left to reveal action buttons.
 *
 * - iOS Safari: native touch listeners with `{ passive: false }` so horizontal
 *   `preventDefault` actually runs (React pointer events are often passive).
 * - Desktop: do not capture the pointer until a horizontal drag is confirmed,
 *   and ignore presses that start on buttons/links so clicks still work.
 *
 * Actions render left→right as listed; the last action sits at the far right.
 */
export function SwipeReveal(props: {
  children: ReactNode;
  actions: SwipeAction[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
}) {
  const { children, actions, open, onOpenChange, disabled } = props;
  const panelWidth = Math.max(1, actions.length) * SWIPE_ACTION_WIDTH;
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const onOpenChangeRef = useRef(onOpenChange);
  const disabledRef = useRef(disabled);
  const panelWidthRef = useRef(panelWidth);
  const offsetRef = useRef(open ? -panelWidth : 0);
  const draggingRef = useRef(false);

  onOpenChangeRef.current = onOpenChange;
  disabledRef.current = disabled;
  panelWidthRef.current = panelWidth;

  const applyOffset = (px: number) => {
    const max = panelWidthRef.current;
    const clamped = Math.max(-max, Math.min(0, px));
    offsetRef.current = clamped;
    const track = trackRef.current;
    if (track) track.style.transform = `translate3d(${clamped}px,0,0)`;
  };

  const setDraggingClass = (on: boolean) => {
    draggingRef.current = on;
    rootRef.current?.classList.toggle('is-dragging', on);
  };

  useEffect(() => {
    if (draggingRef.current) return;
    applyOffset(open ? -panelWidthRef.current : 0);
  }, [open, panelWidth]);

  /** Close when the user taps/clicks anywhere outside this row. */
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const root = rootRef.current;
      if (!root?.contains(e.target as Node)) {
        onOpenChangeRef.current(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
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
      const max = panelWidthRef.current;
      const shouldOpen = offsetRef.current < -max * 0.35;
      onOpenChangeRef.current(shouldOpen);
      applyOffset(shouldOpen ? -max : 0);
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

    const onTouchStart = (e: TouchEvent) => {
      if (disabledRef.current || e.touches.length !== 1) return;
      // Do not skip buttons — Android users swipe from Dâng lại / share.
      // A tap without horizontal travel still fires the button click.
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

    const onPointerDown = (e: PointerEvent) => {
      if (disabledRef.current) return;
      if (e.pointerType === 'touch') return;
      if (e.button !== 0) return;
      if (isInteractiveTarget(e.target)) return;
      pointerId = e.pointerId;
      begin(e.clientX, e.clientY);
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
      <div
        className="swipe-reveal-actions"
        style={{ width: panelWidth }}
        aria-hidden={!open}
      >
        {actions.map(action => (
          <button
            key={action.key}
            type="button"
            className={`swipe-reveal-action${
              action.danger ? ' is-danger' : ''
            }`}
            tabIndex={open ? 0 : -1}
            onClick={() => {
              onOpenChange(false);
              action.onClick();
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
      <div
        ref={trackRef}
        className="swipe-reveal-track"
        style={{
          transform: `translate3d(${open ? -panelWidth : 0}px,0,0)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
