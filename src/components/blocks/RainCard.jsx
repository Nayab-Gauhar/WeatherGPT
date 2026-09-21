import { UmbrellaIcon, SunIcon } from '../Icons.jsx';
import { t } from '../../i18n/index.js';
import { hourLabel } from '../../utils/format.js';

/**
 * Focused answer to "will it rain?".
 *
 * Gives the verdict, the amount, and — most usefully — the window during which
 * rain is most likely, so the reader can plan around it rather than around the
 * whole day.
 */
export default function RainCard({ forecast, dayIndex = 0, willRain, lang }) {
  const day = forecast.daily?.[dayIndex];
  if (!day) return null;

  const dayHours = forecast.hourly.filter((h) => h.time.startsWith(day.date));
  const wettest = dayHours.reduce(
    (best, h) => ((h.pop ?? 0) > (best?.pop ?? -1) ? h : best),
    null,
  );

  // Contiguous block of hours where rain probability stays elevated.
  const window = (() => {
    const wet = dayHours.filter((h) => (h.pop ?? 0) >= 40);
    if (!wet.length) return null;
    return { from: wet[0].time, to: wet.at(-1).time };
  })();

  return (
    <article className={`card card--rain${willRain ? ' is-wet' : ' is-dry'}`}>
      <span className="rain__icon">
        {willRain ? <UmbrellaIcon width={22} height={22} /> : <SunIcon width={22} height={22} />}
      </span>

      <div className="rain__facts">
        <div className="rain__fact">
          <span className="rain__label">{t('rainChance', lang)}</span>
          <span className="rain__value">{day.pop != null ? `${Math.round(day.pop)}%` : '—'}</span>
        </div>
        <div className="rain__fact">
          <span className="rain__label">{t('rainfall', lang)}</span>
          <span className="rain__value">
            {day.rain != null ? `${day.rain.toFixed(1)} mm` : '—'}
          </span>
        </div>
        {day.rainHours != null && (
          <div className="rain__fact">
            <span className="rain__label">Wet hours</span>
            <span className="rain__value">{Math.round(day.rainHours)} h</span>
          </div>
        )}
        {window && (
          <div className="rain__fact rain__fact--wide">
            <span className="rain__label">Most likely</span>
            <span className="rain__value">
              {hourLabel(window.from)} – {hourLabel(window.to)}
              {wettest && ` · peak ${Math.round(wettest.pop)}%`}
            </span>
          </div>
        )}
      </div>
    </article>
  );
}
