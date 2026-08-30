import { useMemo } from 'react';
import { useLocale } from '../i18n/LocaleContext.js';
import {
  addMonths,
  buildSolarMonthGrid,
  calendarEmptyKind,
  defaultSelectedYmdForMonth,
  excludeSpecialDuplicateMemorials,
  lunarCellLabel,
  lunarTimeZone,
  memorialsInMonth,
  memorialsOnYmd,
  orderMonthSpecials,
  parseYmd,
  specialCoversYmd,
  specialsInMonth,
  specialsOnYmd,
  todayYmd,
  type CalendarDay,
  type CalendarMemorial,
} from '../lib/calendarMonth.js';
import { canChiYear, solarToLunar } from '../lib/lunarCalendar.js';
import {
  formatSpecialEventDateLabel,
  formatSpecialListName,
  type TempleSpecialProfileUi,
} from '../lib/specialsUi.js';

export function LunarCalendar(props: {
  specials: TempleSpecialProfileUi[];
  memorials: CalendarMemorial[];
  selectedYmd: string;
  onSelectedYmdChange: (ymd: string) => void;
  onOpenSpecial: (sp: TempleSpecialProfileUi) => void;
  onOpenMemorial: (txid: string) => void;
  disabled?: boolean;
}) {
  const { locale, t } = useLocale();
  const now = useMemo(() => new Date(), []);
  const parsed = parseYmd(props.selectedYmd);
  const cursor = parsed
    ? { year: parsed.y, month: parsed.m }
    : { year: now.getFullYear(), month: now.getMonth() + 1 };
  const selectedYmd = props.selectedYmd;

  const days = useMemo(
    () => buildSolarMonthGrid(cursor.year, cursor.month, locale, now),
    [cursor.year, cursor.month, locale, now],
  );

  const selected =
    days.find(d => d.ymd === selectedYmd) ??
    days.find(d => d.inMonth && d.ymd === defaultSelectedYmdForMonth(
      cursor.year,
      cursor.month,
      now,
    )) ??
    days.find(d => d.inMonth) ??
    days[0]!;
  const inMonthDays = days.filter(d => d.inMonth);
  const personalMemorials = useMemo(
    () => excludeSpecialDuplicateMemorials(props.memorials, props.specials),
    [props.memorials, props.specials],
  );
  const monthSpecials = orderMonthSpecials(
    specialsInMonth(props.specials, cursor.year, cursor.month, locale),
    selected.ymd,
    locale,
  );
  const monthMemorials = memorialsInMonth(
    personalMemorials,
    inMonthDays,
    selected.ymd,
    locale,
  );
  const selectedDaySpecials = specialsOnYmd(
    props.specials,
    selected.ymd,
    locale,
  );
  const selectedDayMemorials = memorialsOnYmd(
    personalMemorials,
    selected,
    locale,
  );
  const emptyKind = calendarEmptyKind(
    monthSpecials.length + monthMemorials.length,
    selectedDaySpecials.length + selectedDayMemorials.length,
  );

  const monthTitle = new Date(cursor.year, cursor.month - 1, 1).toLocaleDateString(
    locale === 'zh' ? 'zh-CN' : locale === 'vi' ? 'vi-VN' : 'en-GB',
    { month: 'long', year: 'numeric' },
  );

  const todayLunar = solarToLunar(
    now.getDate(),
    now.getMonth() + 1,
    now.getFullYear(),
    lunarTimeZone(locale),
  );
  const todayCanChi = canChiYear(
    todayLunar.year,
    locale.startsWith('zh') ? 'zh' : 'vi',
  );
  const todayLunarLine = locale.startsWith('zh')
    ? `农历${todayCanChi}年${todayLunar.leap ? '闰' : ''}${todayLunar.month}月${todayLunar.day}日`
    : locale.startsWith('vi')
      ? `Ngày ${todayLunar.day} tháng ${todayLunar.month}${todayLunar.leap ? ' (nhuận)' : ''} năm ${todayCanChi}`
      : `Lunar ${todayLunar.day}/${todayLunar.month}${todayLunar.leap ? ' leap' : ''} · ${todayCanChi}`;

  const weekdayLabels = [0, 1, 2, 3, 4, 5, 6].map(i =>
    new Date(2024, 0, 1 + i).toLocaleDateString(
      locale === 'zh' ? 'zh-CN' : locale === 'vi' ? 'vi-VN' : 'en-GB',
      { weekday: 'narrow' },
    ),
  );

  function goToday() {
    props.onSelectedYmdChange(todayYmd(new Date()));
  }

  function goMonth(delta: number) {
    const next = addMonths(cursor.year, cursor.month, delta);
    props.onSelectedYmdChange(
      defaultSelectedYmdForMonth(next.year, next.month, new Date()),
    );
  }

  function marksFor(day: CalendarDay): { special: boolean; memorial: boolean } {
    return {
      special: specialsOnYmd(props.specials, day.ymd, locale).length > 0,
      memorial: memorialsOnYmd(personalMemorials, day, locale).length > 0,
    };
  }

  return (
    <section className="panel calendar-panel" aria-label={t('tabCalendar')}>
      <div className="calendar-today">
        <p className="calendar-today-kicker">{t('calendarToday')}</p>
        <p className="calendar-today-solar">
          {now.toLocaleDateString(
            locale === 'zh' ? 'zh-CN' : locale === 'vi' ? 'vi-VN' : 'en-GB',
            { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
          )}
        </p>
        <p className="calendar-today-lunar">{todayLunarLine}</p>
        <p className="hint calendar-hint">{t('calendarHint')}</p>
      </div>

      <div className="calendar-weekdays" aria-hidden="true">
        {weekdayLabels.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>

      <div className="calendar-grid" role="grid" aria-label={monthTitle}>
        {days.map(day => {
          const marks = marksFor(day);
          const selectedDay = day.ymd === selected.ymd;
          return (
            <button
              key={day.ymd}
              type="button"
              role="gridcell"
              aria-current={day.isToday ? 'date' : undefined}
              aria-selected={selectedDay}
              className={[
                'calendar-cell',
                day.inMonth ? '' : 'is-outside',
                day.isToday ? 'is-today' : '',
                selectedDay ? 'is-selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => {
                props.onSelectedYmdChange(day.ymd);
              }}
            >
              <span className="calendar-cell-solar">{day.solarD}</span>
              <span className="calendar-cell-lunar">
                {lunarCellLabel(day.lunar, locale)}
              </span>
              {marks.special || marks.memorial ? (
                <span className="calendar-dots">
                  {marks.special ? <i className="calendar-dot calendar-dot--special" /> : null}
                  {marks.memorial ? <i className="calendar-dot calendar-dot--memorial" /> : null}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="calendar-nav">
        <button
          type="button"
          className="header-icon-btn"
          aria-label={t('calendarPrevMonth')}
          onClick={() => goMonth(-1)}
        >
          ‹
        </button>
        <h2 className="calendar-month-title">{monthTitle}</h2>
        <button
          type="button"
          className="header-icon-btn"
          aria-label={t('calendarNextMonth')}
          onClick={() => goMonth(1)}
        >
          ›
        </button>
      </div>

      <div className="calendar-day-panel">
        <div className="calendar-day-heading-row">
          <h3 className="calendar-day-heading">
            {selected.solarD}/{selected.solarM}
            <span className="calendar-day-lunar">
              {' · '}
              {locale.startsWith('zh')
                ? `${selected.lunar.leap ? '闰' : ''}${selected.lunar.month}月${selected.lunar.day}日`
                : locale.startsWith('vi')
                  ? `ngày ${selected.lunar.day}/${selected.lunar.month}${selected.lunar.leap ? ' nhuận' : ''}`
                  : `lunar ${selected.lunar.day}/${selected.lunar.month}${selected.lunar.leap ? ' leap' : ''}`}
            </span>
          </h3>
          {selected.ymd === todayYmd(now) ? (
            <span className="calendar-today-label">{t('calendarToday')}</span>
          ) : (
            <button
              type="button"
              className="link-more calendar-today-btn"
              onClick={goToday}
            >
              {t('calendarViewToday')}
            </button>
          )}
        </div>

        {emptyKind === 'month' ? (
          <p className="hint">{t('calendarEmptyMonth')}</p>
        ) : emptyKind === 'day' ? (
          <p className="hint">
            {t('calendarEmptyDay', {
              d: selected.solarD,
              m: selected.solarM,
            })}
          </p>
        ) : null}

        {monthSpecials.length > 0 ? (
          <ul className="calendar-day-list">
            {monthSpecials.map(sp => {
              const onSelected = specialCoversYmd(sp, selected.ymd, locale);
              return (
                <li key={sp.id || sp.profileId || sp.name}>
                  <button
                    type="button"
                    className={[
                      'calendar-day-item',
                      onSelected ? 'is-on-selected' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    disabled={props.disabled}
                    onClick={() => props.onOpenSpecial(sp)}
                  >
                    <span className="calendar-day-item-name">
                      {formatSpecialListName(sp, locale)}
                    </span>
                    <span className="calendar-day-item-kind">
                      {onSelected && sp.active
                        ? t('homeEventsOngoing')
                        : formatSpecialEventDateLabel(sp, locale)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        {monthMemorials.length > 0 ? (
          <>
            <h4 className="calendar-day-sub">{t('calendarMemorialsHeading')}</h4>
            <ul className="calendar-day-list">
              {monthMemorials.map(m => {
                const onSelected = m.onYmd === selected.ymd;
                const p = m.onYmd.split('-');
                const dateLabel =
                  p.length === 3 ? `${Number(p[2])}/${Number(p[1])}` : m.onYmd;
                return (
                  <li key={m.parentTxid}>
                    <button
                      type="button"
                      className={[
                        'calendar-day-item',
                        onSelected ? 'is-on-selected' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      disabled={props.disabled}
                      onClick={() => props.onOpenMemorial(m.parentTxid)}
                    >
                      <span className="calendar-day-item-name">{m.name}</span>
                      <span className="calendar-day-item-kind">{dateLabel}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
      </div>
    </section>
  );
}
