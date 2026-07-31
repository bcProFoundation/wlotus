/**
 * Theme-aware bold W mark: white on dark UI, black on temple (light) UI.
 * Pass `badge` for a white mark on a black rounded square (favicon-style) —
 * use on light surfaces where the mark must stay white (re-offer, history).
 */
export function BrandMark(props: {
  className?: string;
  width?: number;
  height?: number;
  /** White W on black rounded square — not theme-swapped. */
  badge?: boolean;
}) {
  const w = props.width ?? 56;
  const h = props.height ?? 56;
  if (props.badge) {
    const wrapClass = ['brand-mark-badge', props.className]
      .filter(Boolean)
      .join(' ');
    return (
      <span
        className={wrapClass}
        style={{ width: w, height: h }}
        aria-hidden="true"
      >
        <img
          className="brand-mark-badge-img"
          src="/images/W-bold.png"
          alt=""
          width={w}
          height={h}
          draggable={false}
        />
      </span>
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
