import WeatherIcon from '../WeatherIcon.jsx';
import { conditionLabel } from '../../data/wmo.js';
import { t } from '../../i18n/index.js';
import { hourLabel, temp } from '../../utils/format.js';

/**
 * Next-24-hours strip, sampled every three hours.
 *
 * Three-hourly is the cadence IMD itself uses for nowcast bulletins, and it
 * fits the width without scrolling on a phone.
 */
export default function HourlyCard({ forecast, hours = 24, startAtDay = 0, lang }) {
  const start = (forecast.hourlyIndexNow ?? 0) + startAtDay * 24;
  const window = forecast.hourly.slice(start, start + hours);

  // Sample every 3rd hour, skipping the current hour so the first column is a
  // genuine forecast rather than a repeat of the observation above.
  const slots = window.filter((_, i) => i % 3 === 0 && i > 0).slice(0, 6);
  if (!slots.length) return null;

  const showPop = slots.some((s) => (s.pop ?? 0) >= 20);

  return (
    <article className="card card--hourly">
      <h3 className="card__label">{t('next24h', lang)}</h3>
      <ul className="hourly">
        {slots.map((slot) => (
          <li className="hourly__slot" key={slot.time}>
            <p className="hourly__time">{hourLabel(slot.time)}</p>
            <WeatherIcon
              code={slot.code}
              isDay={slot.isDay}
              size={30}
              label={conditionLabel(slot.code, lang)}
            />
            <p className="hourly__temp">{temp(slot.temp)}</p>
            {showPop && (
              <p className={`hourly__pop${(slot.pop ?? 0) >= 40 ? ' is-likely' : ''}`}>
                {slot.pop != null ? `${Math.round(slot.pop)}%` : ''}
              </p>
            )}
          </li>
        ))}
      </ul>
    </article>
  );
}
