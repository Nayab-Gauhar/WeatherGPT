import { t } from '../../i18n/index.js';

/**
 * Climate-trend card.
 *
 * Plots the same calendar month across ~15 years from the ERA5 reanalysis, so
 * the comparison is seasonally fair, and states the least-squares trend per
 * decade rather than leaving the reader to eyeball it.
 */
export default function ClimateCard({ climate, place, lang }) {
  const series = climate.series ?? [];
  if (series.length < 2) {
    return (
      <article className="card">
        <h3 className="card__label">{t('climateTrends', lang)}</h3>
        <p className="card__sub">Not enough archive data for this location.</p>
      </article>
    );
  }

  const temps = series.map((s) => s.meanTemp);
  const rains = series.map((s) => s.rainfall);
  const tMin = Math.min(...temps);
  const tMax = Math.max(...temps);
  const tSpan = Math.max(tMax - tMin, 0.8);
  const rainMax = Math.max(...rains, 1);

  const width = 100;
  const height = 42;
  const x = (i) => (i / (series.length - 1)) * width;
  const y = (v) => height - ((v - tMin) / tSpan) * height;

  const line = series.map((s, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(s.meanTemp).toFixed(2)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;

  const warming = climate.tempTrendPerDecade;
  const wetter = climate.rainTrendPerDecade;

  return (
    <article className="card card--climate">
      <header className="card__head">
        <div>
          <h3 className="card__title">
            {t('climateTrends', lang)} · {place.name}
          </h3>
          <p className="card__sub">
            {climate.monthName} {climate.fromYear}–{climate.toYear} · {climate.source}
          </p>
        </div>
      </header>

      <div className="climate__stats">
        <div className="stat">
          <span className="stat__label">{climate.monthName} {t('normalLabel', lang)}</span>
          <span className="stat__value">{climate.normalTemp}°C</span>
        </div>
        <div className="stat">
          <span className="stat__label">Temperature trend</span>
          <span className={`stat__value ${warming > 0 ? 'is-warm' : 'is-cool'}`}>
            {warming > 0 ? '+' : ''}
            {warming}°C<em>/decade</em>
          </span>
        </div>
        <div className="stat">
          <span className="stat__label">Monthly rainfall</span>
          <span className="stat__value">{climate.normalRain} mm</span>
        </div>
        <div className="stat">
          <span className="stat__label">Rainfall trend</span>
          <span className={`stat__value ${wetter > 0 ? 'is-wet' : 'is-dry'}`}>
            {wetter > 0 ? '+' : ''}
            {wetter} mm<em>/decade</em>
          </span>
        </div>
      </div>

      <figure className="climate__chart">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
          <path className="climate__area" d={area} />
          <path className="climate__line" d={line} vectorEffect="non-scaling-stroke" />
        </svg>
        <figcaption className="climate__axis">
          <span>{series[0].year}</span>
          <span className="climate__legend">mean {climate.monthName} temperature (°C)</span>
          <span>{series.at(-1).year}</span>
        </figcaption>
      </figure>

      <ul className="climate__bars">
        {series.map((s) => (
          <li key={s.year} title={`${s.year}: ${s.rainfall} mm`}>
            <span style={{ height: `${Math.max((s.rainfall / rainMax) * 100, 2)}%` }} />
          </li>
        ))}
      </ul>
      <p className="climate__caption">
        {climate.monthName} rainfall by year · peak {Math.round(rainMax)} mm
      </p>
    </article>
  );
}
