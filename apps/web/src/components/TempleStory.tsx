import { useLocale } from '../i18n/LocaleContext.js';
import {
  specialStoryForLocale,
  type TempleSpecialProfileUi,
} from '../lib/specialsUi.js';

/** Catalog story on special details or during the offering session. */
export function TempleStory(props: {
  special: TempleSpecialProfileUi | null | undefined;
  /** Details: drop the closing lotus-prayer sentence. */
  omitPrayer?: boolean;
  /** Soft-pray: “read while looking for lotuses”. */
  showHint?: boolean;
  className?: string;
}) {
  const { t, locale } = useLocale();
  const st = specialStoryForLocale(props.special ?? null, locale, {
    omitPrayer: props.omitPrayer,
  });
  if (!st) return null;
  const extra = props.className ? ` ${props.className}` : '';
  return (
    <div className={`temple-story${extra}`}>
      <p className="temple-story-heading">{t('specialStoryHeading')}</p>
      {props.showHint ? (
        <p className="temple-story-hint">{t('specialStoryHint')}</p>
      ) : null}
      {st.title ? <h3 className="temple-story-title">{st.title}</h3> : null}
      {st.body.split('\n').map((para, i) =>
        para.trim() ? (
          <p key={i} className="temple-story-para">
            {para}
          </p>
        ) : null,
      )}
    </div>
  );
}
