import { t } from '../../i18n/index.js';
import { aqiBand } from '../../utils/format.js';

/**
 * Air-quality card.
 *
 * The dominant pollutant matters as much as the index — PM2.5-driven pollution
 * calls for masks, ozone-driven pollution calls for avoiding afternoon exertion
 * — so both the number and the constituents are shown.
 */
export default function AqiCard({ air, place, lang }) {
  const band = aqiBand(air.aqi);
  const pollutants = [
    { key: 'PM2.5', value: air.pm25, unit: 'µg/m³', limit: 60 },
    { key: 'PM10', value: air.pm10, unit: 'µg/m³', limit: 100 },
    { key: 'NO₂', value: air.no2, unit: 'µg/m³', limit: 80 },
    { key: 'O₃', value: air.o3, unit: 'µg/m³', limit: 100 },
    { key: 'SO₂', value: air.so2, unit: 'µg/m³', limit: 80 },
    { key: 'CO', value: air.co != null ? air.co / 1000 : null, unit: 'mg/m³', limit: 4 },
  ].filter((p) => p.value != null);

  return (
    <article className="card card--aqi">
      <header className="card__head">
        <h3 className="card__title">
          {t('airQuality', lang)} · {place.name}
        </h3>
      </header>

      <div className="aqi">
        <div className="aqi__dial" style={{ '--band': band.color }}>
          <span className="aqi__value">{air.aqi != null ? Math.round(air.aqi) : '—'}</span>
          <span className="aqi__scale">US AQI</span>
        </div>
        <div className="aqi__verdict">
          <p className="aqi__band" style={{ color: band.color }}>
            {band.label}
          </p>
          <p className="card__sub">
            {band.key === 'good'
              ? 'Air quality is satisfactory; outdoor activity is safe for everyone.'
              : band.key === 'moderate'
                ? 'Acceptable for most people. Unusually sensitive individuals may notice irritation.'
                : band.key === 'unhealthy_sensitive'
                  ? 'Sensitive groups — children, elderly, asthmatics — should limit prolonged outdoor exertion.'
                  : band.key === 'unhealthy'
                    ? 'Everyone may begin to feel effects. Reduce outdoor exertion and prefer an N95 mask.'
                    : band.key === 'very_unhealthy'
                      ? 'Health warning. Avoid outdoor activity; run an air purifier indoors if available.'
                      : 'Emergency conditions. Remain indoors and keep windows closed.'}
          </p>
        </div>
      </div>

      <ul className="pollutants">
        {pollutants.map((p) => {
          const ratio = Math.min(1, p.value / p.limit);
          return (
            <li className="pollutant" key={p.key}>
              <span className="pollutant__name">{p.key}</span>
              <span className="pollutant__track">
                <span
                  className="pollutant__fill"
                  style={{
                    width: `${Math.max(ratio * 100, 3)}%`,
                    background: ratio > 1 ? 'var(--red)' : ratio > 0.66 ? 'var(--orange)' : 'var(--green)',
                  }}
                />
              </span>
              <span className="pollutant__value">
                {p.value < 10 ? p.value.toFixed(1) : Math.round(p.value)}
                <em>{p.unit}</em>
              </span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
