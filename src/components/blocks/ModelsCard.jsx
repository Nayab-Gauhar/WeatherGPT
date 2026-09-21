import { t } from '../../i18n/index.js';
import { temp, weekdayLabel } from '../../utils/format.js';

/**
 * NWP model comparison.
 *
 * Runs the same forecast through GFS, ECMWF IFS and ICON and shows where they
 * disagree. Disagreement is the honest expression of forecast uncertainty — a
 * 0.4 °C spread on day 2 and a 6 °C spread on day 5 are very different pieces
 * of information, and a single blended number hides that.
 */
const CONFIDENCE_COLOR = {
  high: 'var(--green)',
  moderate: 'var(--yellow)',
  low: 'var(--orange)',
};

export default function ModelsCard({ comparison, place, lang }) {
  const { runs, spread, meanSpread, confidence } = comparison;
  if (!runs?.length) return null;

  const dayCount = spread.length;

  return (
    <article className="card card--models">
      <header className="card__head">
        <div>
          <h3 className="card__title">
            {t('modelGuidance', lang)} · {place.name}
          </h3>
          <p className="card__sub">Daily maximum temperature, next {dayCount} days</p>
        </div>
        <span className="chipbadge" style={{ '--c': CONFIDENCE_COLOR[confidence] }}>
          {confidence} confidence
        </span>
      </header>

      <div className="models__grid" style={{ '--cols': dayCount }}>
        <div className="models__row models__row--head">
          <span className="models__name" />
          {spread.map((s) => (
            <span className="models__cell" key={s.date}>
              {weekdayLabel(s.date, lang)}
            </span>
          ))}
        </div>

        {runs.map((run) => (
          <div className="models__row" key={run.id}>
            <span className="models__name">
              <strong>{run.label}</strong>
              <em>
                {run.agency} · {run.resolution}
              </em>
            </span>
            {run.days.slice(0, dayCount).map((d) => (
              <span className="models__cell" key={d.date}>
                {temp(d.tmax)}
              </span>
            ))}
          </div>
        ))}

        <div className="models__row models__row--spread">
          <span className="models__name">
            <strong>{t('spread', lang)}</strong>
          </span>
          {spread.map((s) => (
            <span
              className={`models__cell models__cell--spread${s.tmaxSpread >= 3 ? ' is-wide' : ''}`}
              key={s.date}
            >
              ±{s.tmaxSpread}
            </span>
          ))}
        </div>
      </div>

      <p className="models__note">
        {t('agreement', lang)}: models differ by {meanSpread}°C on average.{' '}
        {confidence === 'high'
          ? 'Strong agreement — the forecast can be relied on for planning.'
          : confidence === 'moderate'
            ? 'Reasonable agreement in the short range; treat later days as indicative.'
            : 'Models disagree noticeably — expect the forecast to be revised.'}
      </p>
    </article>
  );
}
