/**
 * Theme-aware bold W mark: white on dark UI, black on temple (light) UI.
 * Pass `badge` to use the favicon asset (white W on black rounded square).
 */
export function BrandMark(props: {
  className?: string;
  width?: number;
  height?: number;
  /** Favicon-style white W on black rounded square — not theme-swapped. */
  badge?: boolean;
}) {
  const w = props.width ?? 56;
  const h = props.height ?? 56;
  if (props.badge) {
    const cls = ['brand-mark-badge', props.className].filter(Boolean).join(' ');
    return (
      <img
        className={cls}
        src="/images/wlotus-icon-32.png"
        alt=""
        width={w}
        height={h}
        draggable={false}
        aria-hidden="true"
      />
    );
  }

  const wrapClass = ['brand-mark-wrap', props.className].filter(Boolean).join(' ');
  return (
    <span className={wrapClass} style={{ height: h }} aria-hidden="true">
      <img
        className="brand-mark brand-mark--on-dark"
        src="/images/W-bold.png"
        alt=""
        width={w}
        height={h}
        draggable={false}
      />
      <img
        className="brand-mark brand-mark--on-light"
        src="/images/W-black-bold.png"
        alt=""
        width={w}
        height={h}
        draggable={false}
      />
    </span>
  );
}
