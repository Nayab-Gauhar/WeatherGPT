import {
  SunIcon,
  CalendarIcon,
  AlertIcon,
  LeafIcon,
  ChartIcon,
  WindIcon,
  MicIcon,
  LayersIcon,
} from '../Icons.jsx';

const ITEMS = [
  { icon: SunIcon, title: 'Live conditions', body: 'Observations for any village, town or coordinate.' },
  { icon: CalendarIcon, title: 'Forecasts', body: 'Hourly through 16-day outlooks in plain language.' },
  { icon: AlertIcon, title: 'Warnings', body: 'Colour-coded rain, heat, cold, wind and fog alerts.' },
  { icon: LeafIcon, title: 'Sector advisories', body: 'Agriculture, aviation, marine and urban guidance.' },
  { icon: ChartIcon, title: 'Climate trends', body: '15 years of reanalysis with per-decade trends.' },
  { icon: WindIcon, title: 'Air quality', body: 'AQI with the pollutants driving it.' },
  { icon: LayersIcon, title: 'Model guidance', body: 'GFS, ECMWF and ICON compared side by side.' },
  { icon: MicIcon, title: 'Voice & 10 languages', body: 'Ask by speaking; answers read back aloud.' },
];

/** Shown with the welcome message and whenever a question cannot be resolved. */
export default function Capabilities() {
  return (
    <ul className="caps">
      {ITEMS.map(({ icon: Icon, title, body }) => (
        <li className="caps__item" key={title}>
          <span className="caps__icon">
            <Icon width={16} height={16} />
          </span>
          <div>
            <p className="caps__title">{title}</p>
            <p className="caps__body">{body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
