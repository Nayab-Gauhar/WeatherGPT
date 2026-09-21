import WeatherIcon from '../WeatherIcon.jsx';
import { conditionLabel } from '../../data/wmo.js';
import { t } from '../../i18n/index.js';
import { temp, timeLabel, weekdayLabel, dayMonthLabel } from '../../utils/format.js';

/** Single-day detail, used when the user asks about one specific day. */
export default function DaySummaryCard({ day, dayIndex, lang }) {
  if (!day) return null;

  const rows = [
    { label: t('high', lang), value: temp(day.tmax, { unit: true }) },
    { label: t('low', lang), value: temp(day.tmin, { unit: true }) },
    { label: t('rainChance', lang), value: day.pop != null ? `${Math.round(day.pop)}%` : '—' },
    { label: t('rainfall', lang), value: day.rain != null ? `${day.rain.toFixed(1)} mm` : '—' },
    { label: t('wind', lang), value: day.windMax != null ? `${Math.round(day.windMax)} km/h` : '—' },
    { label: t('uvIndex', lang), value: day.uv != null ? day.uv.toFixed(1) : '—' },
    { label: t('sunrise', lang), value: timeLabel(day.sunrise) },
    { label: t('sunset', lang), value: timeLabel(day.sunset) },
  ];

  return (
    <article className="card card--day">
      <header className="card__head">
        <div>
          <h3 className="card__title">
            {dayIndex === 1 ? t('tomorrow', lang) : weekdayLabel(day.date, lang)}
          </h3>
          <p className="card__sub">{dayMonthLabel(day.date, lang)}</p>
        </div>
        <div className="day__hero">
          <WeatherIcon code={day.code} size={44} label={conditionLabel(day.code, lang)} />
          <span>{conditionLabel(day.code, lang)}</span>
        </div>
      </header>

      <dl className="daygrid">
        {rows.map((r) => (
          <div className="daygrid__cell" key={r.label}>
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
