/**
 * White W glyph. Dark UI (EN / offering / ZH rosewood) shows it with no plate.
 * Light cream uses a baked rounded black square (white W in the PNG)
 * so the mark cannot collapse to an empty black tile.
 * Dark (EN/VI black, ZH rosewood) shows the transparent white glyph.
 * `badge` is the same pair at favicon size for history / re-offer rows.
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
  const lightSrc = props.badge
    ? '/images/wlotus-icon-32.png'
    : '/images/wlotus-icon-192.png';

  const imgs = (
    <>
      <img
        className="brand-mark brand-mark--on-dark"
        src="/images/W-white.png"
        alt=""
        width={w}
        height={h}
        draggable={false}
      />
      <img
        className="brand-mark brand-mark--on-light"
        src={lightSrc}
        alt=""
        width={w}
        height={h}
        draggable={false}
      />
    </>
  );

  if (props.badge) {
    const cls = ['brand-mark-badge', props.className].filter(Boolean).join(' ');
    return (
      <span className={cls} aria-hidden="true">
        {imgs}
      </span>
    );
  }

  const wrapClass = ['brand-mark-wrap', props.className].filter(Boolean).join(' ');
  return (
    <span className={wrapClass} style={{ height: h }} aria-hidden="true">
      {imgs}
    </span>
  );
}
