/** Theme-aware W mark: white on dark UI, black on temple (light) UI. */
export function BrandMark(props: {
  className?: string;
  width?: number;
  height?: number;
}) {
  const wrapClass = ['brand-mark-wrap', props.className].filter(Boolean).join(' ');
  const w = props.width ?? 56;
  const h = props.height ?? 56;
  return (
    <span className={wrapClass} aria-hidden="true">
      <img
        className="brand-mark brand-mark--on-dark"
        src="/images/W.png"
        alt=""
        width={w}
        height={h}
        draggable={false}
      />
      <img
        className="brand-mark brand-mark--on-light"
        src="/images/W-black.png"
        alt=""
        width={w}
        height={h}
        draggable={false}
      />
    </span>
  );
}
