import type { HTMLAttributes, ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Full-screen sheets. Portal to `document.body` so they stack above the
 * Home/Calendar bar (also a body portal). `#root` is `z-index: 1`, so a
 * `z-index: 50` sheet inside the app still loses to the bar at 45.
 */
export function OfferModal(
  props: HTMLAttributes<HTMLDivElement> & { children: ReactNode },
) {
  return createPortal(<div {...props} />, document.body);
}
