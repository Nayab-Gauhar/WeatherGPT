import WeatherIcon from '../WeatherIcon.jsx';
import { conditionLabel } from '../../data/wmo.js';
import { t } from '../../i18n/index.js';
import { dayMonthLabel, temp, weekdayLabel } from '../../utils/format.js';

/**
 * Multi-day outlook.
 *
 * The temperature range is drawn as a bar scaled to the whole period, so the
 * shape of a warming or cooling trend is visible at a glance rather than
 * requiring the reader to compare numbers row by row.
 */
export default function DailyCard({ forecast, lang, highlight }) {
  const days = forecast.daily ?? [];
  if (!days.length) return null;

  const lows = days.map((d) => d.tmin).filter((v) => v != null);
  const highs = days.map((d) => d.tmax).filter((v) => v != null);
  const floor = Math.min(...lows);
  const ceiling = Math.max(...highs);
  const span = Math.max(ceiling - floor, 1);

  return (
    <article className="card card--daily">
      <h3 className="card__label">{t('sevenDay', lang)}</h3>
      <ul className="daily">
        {days.map((day, i) => {
          const left = ((day.tmin - floor) / span) * 100;
          const width = ((day.tmax - day.tmin) / span) * 100;
          return (
            <li
              className={`daily__row${i === highlight ? ' is-highlight' : ''}`}
              key={day.date}
            >
              <div className="daily__day">
                <span className="daily__name">
                  {i === 0 ? t('today', lang) : i === 1 ? t('tomorrow', lang) : weekdayLabel(day.date, lang)}
                </span>
                <span className="daily__date">{dayMonthLabel(day.date, lang)}</span>
              </div>

              <WeatherIcon
                code={day.code}
                size={28}
                label={conditionLabel(day.code, lang)}
                className="daily__icon"
              />

              <div className="daily__rain">
                {(day.pop ?? 0) >= 20 && (
                  <span className={(day.pop ?? 0) >= 60 ? 'is-likely' : ''}>
                    {Math.round(day.pop)}%
                  </span>
                )}
                {(day.rain ?? 0) >= 1 && <em>{Math.round(day.rain)} mm</em>}
              </div>

              <div className="daily__range">
                <span className="daily__min">{temp(day.tmin)}</span>
                <span className="daily__track">
                  <span
                    className="daily__bar"
                    style={{ left: `${left}%`, width: `${Math.max(width, 6)}%` }}
                  />
                </span>
                <span className="daily__max">{temp(day.tmax)}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
