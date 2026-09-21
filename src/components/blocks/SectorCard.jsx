import { LeafIcon, PlaneIcon, AnchorIcon, BuildingIcon } from '../Icons.jsx';

const SECTOR_ICON = {
  agriculture: LeafIcon,
  aviation: PlaneIcon,
  marine: AnchorIcon,
  urban: BuildingIcon,
};

/**
 * Sector decision support.
 *
 * Each row is a decision, not a measurement: "Spraying — Not advised, because
 * rain will wash off foliar application". That framing is what makes the same
 * forecast useful to a farmer, a pilot, a skipper and a city engineer.
 */
export default function SectorCard({ advisory }) {
  const Icon = SECTOR_ICON[advisory.sector] ?? LeafIcon;

  return (
    <article className={`card card--sector card--sector-${advisory.sector}`}>
      <header className="sector__head">
        <span className="sector__icon">
          <Icon width={18} height={18} />
        </span>
        <div>
          <h3 className="card__title">{advisory.title}</h3>
          <p className="card__sub">{advisory.headline}</p>
        </div>
      </header>

      <ul className="sector__list">
        {advisory.points.map((point) => (
          <li className="sector__item" key={point.label}>
            <div className="sector__row">
              <span className="sector__label">{point.label}</span>
              <span className={`sector__verdict${verdictTone(point.value)}`}>{point.value}</span>
            </div>
            <p className="sector__note">{point.note}</p>
          </li>
        ))}
      </ul>
    </article>
  );
}

/** Colour the verdict by whether it implies action, caution or all-clear. */
function verdictTone(value) {
  const v = String(value).toLowerCase();
  if (/not advised|high risk|activate|advance|suspend|defer|elevated|inspect|lifr|ifr\b/.test(v)) {
    return ' is-warn';
  }
  if (/caution|moderate|reduce|marginal|mvfr|likely|disruption/.test(v)) return ' is-watch';
  return ' is-ok';
}
