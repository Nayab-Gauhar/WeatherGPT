import WeatherIcon from '../WeatherIcon.jsx';
import { conditionLabel } from '../../data/wmo.js';
import { t } from '../../i18n/index.js';
import { coordLabel, placeLabel, temp, updatedLabel } from '../../utils/format.js';

/**
 * The primary observation card: place identity, headline temperature and the
 * five metrics a user checks before leaving the house.
 */
export default function CurrentCard({ place, forecast, lang }) {
  const c = forecast.current;

  const metrics = [
    { label: t('feelsLike', lang), value: temp(c.feelsLike, { unit: true }) },
    { label: t('humidity', lang), value: c.humidity != null ? `${Math.round(c.humidity)}%` : '—' },
    {
      label: t('wind', lang),
      value:
        c.windSpeed != null
          ? `${Math.round(c.windSpeed)} km/h${c.windCompass ? ` (${c.windCompass})` : ''}`
          : '—',
    },
    { label: t('pressure', lang), value: c.pressure ? `${c.pressure} hPa` : '—' },
    { label: t('visibility', lang), value: c.visibilityKm != null ? `${c.visibilityKm} km` : '—' },
  ];

  return (
    <article className="card card--current">
      <header className="card__head">
        <div>
          <h3 className="card__title">{placeLabel(place)}</h3>
          <p className="card__sub">{coordLabel(place.latitude, place.longitude)}</p>
        </div>
        <p className="card__stamp">
          {t('updated', lang)}: {updatedLabel(c.time)}
        </p>
      </header>

      <div className="current">
        <div className="current__hero">
          <WeatherIcon
            code={c.code}
            isDay={c.isDay}
            size={64}
            label={conditionLabel(c.code, lang)}
          />
          <div className="current__reading">
            <p className="current__temp">{temp(c.temp, { unit: true })}</p>
            <p className="current__cond">{conditionLabel(c.code, lang)}</p>
          </div>
        </div>

        <dl className="metrics">
          {metrics.map((m) => (
            <div className="metrics__row" key={m.label}>
              <dt>{m.label}</dt>
              <dd>{m.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  );
}
