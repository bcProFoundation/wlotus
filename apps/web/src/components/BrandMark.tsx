/**
 * White W glyph. Dark UI (EN black, VI/ZH rosewood, offering) shows it with no plate.
 * Light cream uses a baked rounded black square (white W in the PNG)
 * so the mark cannot collapse to an empty black tile.
 * Dark (EN black, VI/ZH rosewood) shows the transparent white glyph.
 * `badge` is the compact square for history / re-offer rows.
 * Light in-app marks use the padded 192 asset (same as the header), not the
 * tight 16/32 browser favicons.
 * Alignment with neighboring text is CSS-only (`.brand-mark--on-dark` in a
 * lockup). The PNG itself and PWA/boxed plates keep the heavier bowl.
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
        src="/images/wlotus-icon-192.png"
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
