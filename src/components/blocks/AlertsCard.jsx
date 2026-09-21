import { AlertIcon, CheckIcon } from '../Icons.jsx';
import { t } from '../../i18n/index.js';
import { dayMonthLabel } from '../../utils/format.js';

/**
 * Colour-coded warning panel.
 *
 * Follows IMD's impact-based convention — the colour *is* the instruction
 * (yellow = be updated, orange = be prepared, red = take action) — and always
 * pairs the hazard with what to do about it, since a warning without an action
 * is not actionable.
 */
export default function AlertsCard({ warnings, lang, compact = false }) {
  if (!warnings) return null;

  if (warnings.count === 0) {
    return (
      <article className="card card--clear">
        <span className="card__ok">
          <CheckIcon width={16} height={16} />
        </span>
        <div>
          <h3 className="card__label">{t('noWarnings', lang)}</h3>
          <p className="card__sub">{t('allClear', lang)}</p>
        </div>
      </article>
    );
  }

  return (
    <article className={`card card--alerts${compact ? ' is-compact' : ''}`}>
      <h3 className="card__label">
        <AlertIcon width={15} height={15} />
        {t('warnings', lang)}
      </h3>

      <ul className="alerts">
        {warnings.alerts.map((alert) => (
          <li className={`alert alert--${alert.level}`} key={alert.id}>
            <div className="alert__bar" aria-hidden="true" />
            <div className="alert__body">
              <div className="alert__top">
                <h4 className="alert__title">{alert.title}</h4>
                <span className={`alert__badge alert__badge--${alert.level}`}>{alert.levelLabel}</span>
              </div>
              <p className="alert__meta">
                {alert.when === 'today'
                  ? t('today', lang)
                  : alert.when === 'tomorrow'
                    ? t('tomorrow', lang)
                    : dayMonthLabel(alert.date, lang)}
                {' · '}
                {alert.metric}
              </p>
              {!compact && <p className="alert__action">{alert.action}</p>}
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}
