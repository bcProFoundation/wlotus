import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';

const ACTION_WIDTH = 88;

/**
 * Swipe / drag left to reveal a destructive action (iOS-style).
 * Vertical movement is ignored so page scroll and pull-to-refresh still work.
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
  const trackRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const startOffset = useRef(0);
  const offsetRef = useRef(0);
  const axisRef = useRef<'x' | 'y' | null>(null);
  const dragging = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const setOffset = useCallback((px: number) => {
    const clamped = Math.max(-ACTION_WIDTH, Math.min(0, px));
    offsetRef.current = clamped;
    const el = trackRef.current;
    if (el) el.style.transform = `translate3d(${clamped}px,0,0)`;
  }, []);

  useEffect(() => {
    if (isDragging) return;
    setOffset(open ? -ACTION_WIDTH : 0);
  }, [open, isDragging, setOffset]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0) return;
    dragging.current = true;
    axisRef.current = null;
    startX.current = e.clientX;
    startY.current = e.clientY;
    startOffset.current = offsetRef.current;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (axisRef.current == null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      axisRef.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (axisRef.current === 'y') {
        dragging.current = false;
        setIsDragging(false);
        return;
      }
      setIsDragging(true);
    }
    if (axisRef.current !== 'x') return;
    if (e.cancelable) e.preventDefault();
    setOffset(startOffset.current + dx);
  };

  const endDrag = () => {
    const wasHorizontal = axisRef.current === 'x';
    dragging.current = false;
    axisRef.current = null;
    setIsDragging(false);
    if (!wasHorizontal) return;
    const shouldOpen = offsetRef.current < -ACTION_WIDTH * 0.4;
    onOpenChange(shouldOpen);
    setOffset(shouldOpen ? -ACTION_WIDTH : 0);
  };

  return (
    <div
      className={`swipe-reveal${open ? ' is-open' : ''}${
        isDragging ? ' is-dragging' : ''
      }`}
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
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ transform: `translate3d(${open ? -ACTION_WIDTH : 0}px,0,0)` }}
      >
        {children}
      </div>
    </div>
  );
}
