/**
 * Illustrated weather icons.
 *
 * Filled, slightly dimensional shapes rather than line art — at the 20px sizes
 * used in the hourly strip, outline icons for "partly cloudy" and "overcast"
 * become indistinguishable, while filled silhouettes stay readable.
 *
 * Each icon is a 64×64 artboard scaled by the `size` prop, so the same
 * component serves the 72px hero icon and the 26px strip icons.
 */

import { iconFor } from '../data/wmo.js';

const SUN = '#FFC53D';
const SUN_DEEP = '#F7A721';
const MOON = '#CBD5E1';
const MOON_DEEP = '#94A3B8';
const CLOUD = '#E8EDF4';
const CLOUD_MID = '#D2DCE8';
const CLOUD_DARK = '#B4C2D3';
const CLOUD_STORM = '#8FA0B5';
const RAIN = '#4A9BF5';
const RAIN_DEEP = '#2B7BD4';
const SNOW = '#CFE6FF';
const BOLT = '#FFB020';

function Sun({ cx = 24, cy = 24, r = 11 }) {
  return (
    <g>
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i * Math.PI) / 4;
        const inner = r + 3.5;
        const outer = r + 8.5;
        return (
          <line
            key={i}
            x1={cx + Math.cos(angle) * inner}
            y1={cy + Math.sin(angle) * inner}
            x2={cx + Math.cos(angle) * outer}
            y2={cy + Math.sin(angle) * outer}
            stroke={SUN_DEEP}
            strokeWidth="3.2"
            strokeLinecap="round"
          />
        );
      })}
      <circle cx={cx} cy={cy} r={r} fill={SUN} />
      <circle cx={cx - r * 0.3} cy={cy - r * 0.3} r={r * 0.55} fill="#FFD666" opacity="0.7" />
    </g>
  );
}

function Moon({ cx = 24, cy = 23, r = 11 }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={MOON} />
      <circle cx={cx + r * 0.45} cy={cy - r * 0.35} r={r * 0.85} fill="var(--surface)" />
      <circle cx={cx - r * 0.25} cy={cy + r * 0.3} r={r * 0.16} fill={MOON_DEEP} opacity="0.5" />
      <circle cx={cx - r * 0.5} cy={cy - r * 0.2} r={r * 0.1} fill={MOON_DEEP} opacity="0.4" />
    </g>
  );
}

/** Main cloud body, positioned low-right so a sun/moon can peek out top-left. */
function Cloud({ fill = CLOUD, shade = CLOUD_MID, x = 0, y = 0, scale = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path
        d="M18 46c-6.1 0-11-4.9-11-11 0-5.5 4-10 9.3-10.9C18.7 17.4 25 12 32.6 12c8.4 0 15.3 6.5 15.9 14.8 4.7.9 8.2 5 8.2 9.9 0 5.6-4.5 10.1-10.1 10.1H18Z"
        fill={fill}
      />
      <path
        d="M46.6 46.8c5.6 0 10.1-4.5 10.1-10.1 0-4.9-3.5-9-8.2-9.9C47.9 18.5 41 12 32.6 12c-1.2 0-2.3.1-3.4.4 7 1.4 12.4 7.5 12.9 15 4.7.9 8.2 5 8.2 9.9 0 3.7-2 7-4.9 8.8.4.4.8.7 1.2.7Z"
        fill={shade}
      />
    </g>
  );
}

function Drops({ color = RAIN, positions = [], y = 48, length = 7 }) {
  return (
    <g>
      {positions.map((x, i) => (
        <line
          key={i}
          x1={x}
          y1={y + (i % 2) * 2}
          x2={x - 2.5}
          y2={y + length + (i % 2) * 2}
          stroke={color}
          strokeWidth="3.4"
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

function Flakes({ positions = [], y = 50 }) {
  return (
    <g>
      {positions.map((x, i) => (
        <g key={i} transform={`translate(${x} ${y + (i % 2) * 3})`} stroke={SNOW} strokeWidth="2.4" strokeLinecap="round">
          <line x1="-3" y1="0" x2="3" y2="0" />
          <line x1="0" y1="-3" x2="0" y2="3" />
          <line x1="-2.1" y1="-2.1" x2="2.1" y2="2.1" />
          <line x1="2.1" y1="-2.1" x2="-2.1" y2="2.1" />
        </g>
      ))}
    </g>
  );
}

function Bolt() {
  return (
    <path
      d="M31 44h7.5l-3.2 7.4 9.7-11.1h-8l3.6-8.3L31 44Z"
      fill={BOLT}
      stroke="#E08700"
      strokeWidth="0.8"
    />
  );
}

function FogLines() {
  return (
    <g stroke={CLOUD_DARK} strokeWidth="3.4" strokeLinecap="round">
      <line x1="12" y1="50" x2="46" y2="50" />
      <line x1="18" y1="57" x2="52" y2="57" />
    </g>
  );
}

/* ------------------------------------------------------------- icon bodies -- */

const ART = {
  clear: () => <Sun cx={32} cy={32} r={14} />,
  clear_night: () => <Moon cx={32} cy={31} r={14} />,

  mostly_clear: () => (
    <>
      <Sun cx={22} cy={21} r={9.5} />
      <Cloud x={6} y={10} scale={0.78} />
    </>
  ),
  mostly_clear_night: () => (
    <>
      <Moon cx={22} cy={20} r={9.5} />
      <Cloud x={6} y={10} scale={0.78} />
    </>
  ),

  partly_cloudy: () => (
    <>
      <Sun cx={21} cy={20} r={10} />
      <Cloud x={2} y={6} scale={0.92} />
    </>
  ),
  partly_cloudy_night: () => (
    <>
      <Moon cx={21} cy={19} r={10} />
      <Cloud x={2} y={6} scale={0.92} />
    </>
  ),

  overcast: () => (
    <>
      <Cloud x={-4} y={-2} scale={0.7} fill={CLOUD_MID} shade={CLOUD_DARK} />
      <Cloud x={4} y={8} scale={0.92} />
    </>
  ),
  overcast_night: () => (
    <>
      <Cloud x={-4} y={-2} scale={0.7} fill={CLOUD_MID} shade={CLOUD_DARK} />
      <Cloud x={4} y={8} scale={0.92} />
    </>
  ),

  fog: () => (
    <>
      <Cloud x={2} y={-2} scale={0.88} fill={CLOUD} shade={CLOUD_MID} />
      <FogLines />
    </>
  ),

  drizzle: () => (
    <>
      <Cloud x={2} y={-1} scale={0.9} />
      <Drops positions={[24, 33, 42]} y={46} length={5} />
    </>
  ),

  rain: () => (
    <>
      <Cloud x={2} y={-2} scale={0.9} fill={CLOUD} shade={CLOUD_MID} />
      <Drops positions={[22, 31, 40, 49]} y={45} length={8} />
    </>
  ),

  heavy_rain: () => (
    <>
      <Cloud x={2} y={-3} scale={0.92} fill={CLOUD_MID} shade={CLOUD_DARK} />
      <Drops positions={[19, 27, 35, 43, 51]} y={44} length={11} color={RAIN_DEEP} />
    </>
  ),

  showers: () => (
    <>
      <Sun cx={19} cy={18} r={8.5} />
      <Cloud x={4} y={0} scale={0.82} />
      <Drops positions={[27, 36, 45]} y={45} length={7} />
    </>
  ),
  showers_night: () => (
    <>
      <Moon cx={19} cy={17} r={8.5} />
      <Cloud x={4} y={0} scale={0.82} />
      <Drops positions={[27, 36, 45]} y={45} length={7} />
    </>
  ),

  snow: () => (
    <>
      <Cloud x={2} y={-3} scale={0.9} />
      <Flakes positions={[22, 32, 42]} y={49} />
    </>
  ),

  sleet: () => (
    <>
      <Cloud x={2} y={-3} scale={0.9} fill={CLOUD} shade={CLOUD_MID} />
      <Drops positions={[24, 40]} y={45} length={7} />
      <Flakes positions={[32]} y={49} />
    </>
  ),

  thunder: () => (
    <>
      <Cloud x={2} y={-4} scale={0.92} fill={CLOUD_DARK} shade={CLOUD_STORM} />
      <Drops positions={[20, 50]} y={43} length={8} color={RAIN_DEEP} />
      <Bolt />
    </>
  ),
};

// Night variants that reuse the day artwork (precipitation looks the same).
const NIGHT_ALIASES = {
  fog_night: 'fog',
  drizzle_night: 'drizzle',
  rain_night: 'rain',
  heavy_rain_night: 'heavy_rain',
  snow_night: 'snow',
  sleet_night: 'sleet',
  thunder_night: 'thunder',
};

/**
 * @param {object} props
 * @param {number} [props.code]   WMO weather code
 * @param {string} [props.name]   explicit icon key (overrides `code`)
 * @param {boolean} [props.isDay]
 * @param {number} [props.size]
 * @param {string} [props.label]  accessible label; omit to mark decorative
 */
export default function WeatherIcon({ code, name, isDay = true, size = 48, label, className }) {
  const key = name ?? iconFor(code ?? 2, isDay);
  const resolved = ART[key] ? key : (NIGHT_ALIASES[key] ?? key.replace(/_night$/, ''));
  const Art = ART[resolved] ?? ART.partly_cloudy;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <Art />
    </svg>
  );
}
