/**
 * White W glyph. Dark UI (EN / offering / ZH rosewood) shows it with no plate.
 * Light Vietnamese temple wraps it in a rounded black square (CSS).
 * `badge` is the same mark at favicon size for history / re-offer rows.
 */
export function BrandMark(props: {
  className?: string;
  width?: number;
  height?: number;
  /** Compact square mark for list rows and session titles. */
  badge?: boolean;
}) {
  const w = props.width ?? 56;
  const h = props.height ?? 56;
  const img = (
    <img
      className="brand-mark"
      src="/images/W-white.png"
      alt=""
      width={w}
      height={h}
      draggable={false}
    />
  );

  if (props.badge) {
    const cls = ['brand-mark-badge', props.className].filter(Boolean).join(' ');
    return (
      <span className={cls} aria-hidden="true">
        {img}
      </span>
    );
  }

  const wrapClass = ['brand-mark-wrap', props.className].filter(Boolean).join(' ');
  return (
    <span className={wrapClass} style={{ height: h }} aria-hidden="true">
      {img}
    </span>
  );
}
