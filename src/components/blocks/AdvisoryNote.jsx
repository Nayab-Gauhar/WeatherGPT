import {
  UmbrellaIcon,
  SunIcon,
  WindIcon,
  AlertIcon,
  EyeIcon,
  ThermometerIcon,
} from '../Icons.jsx';

const ICONS = {
  umbrella: UmbrellaIcon,
  thunder: AlertIcon,
  heat: ThermometerIcon,
  cold: ThermometerIcon,
  wind: WindIcon,
  fog: EyeIcon,
  sun: SunIcon,
};

/**
 * The plain-language takeaway under an answer — the part a user actually acts
 * on ("carry an umbrella"), as opposed to the numbers above it.
 */
export default function AdvisoryNote({ advisory }) {
  const Icon = ICONS[advisory.icon] ?? SunIcon;
  return (
    <aside className={`note note--${advisory.tone ?? 'info'}`}>
      <span className="note__icon">
        <Icon width={18} height={18} />
      </span>
      <p className="note__text">{advisory.text}</p>
    </aside>
  );
}
