/**
 * UI glyphs. Inline SVG so they inherit `currentColor` and need no extra
 * network request. All are on a 24×24 grid with a 2px stroke.
 */

const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

export const SendIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4.5 12 20 4.5 13.5 20l-2.2-6.3L4.5 12Z" />
  </svg>
);

export const MicIcon = (p) => (
  <svg {...base} {...p}>
    <rect x="9" y="2.5" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
  </svg>
);

export const SunIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2v2.2M12 19.8V22M2 12h2.2M19.8 12H22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M19.1 4.9l-1.6 1.6M6.5 17.5l-1.6 1.6" />
  </svg>
);

export const MoonIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
  </svg>
);

export const GridIcon = (p) => (
  <svg {...base} {...p} strokeWidth="0" fill="currentColor">
    {[5, 12, 19].map((cy) =>
      [5, 12, 19].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.7" />),
    )}
  </svg>
);

export const PlusIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 5.5v13M5.5 12h13" />
  </svg>
);

export const MinusIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M5.5 12h13" />
  </svg>
);

export const LocateIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="3" />
    <circle cx="12" cy="12" r="7.5" />
    <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" />
  </svg>
);

export const PinIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 21.5s7-5.8 7-11a7 7 0 1 0-14 0c0 5.2 7 11 7 11Z" />
    <circle cx="12" cy="10.2" r="2.6" />
  </svg>
);

export const UmbrellaIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9Z" />
    <path d="M12 12v6.5a2.5 2.5 0 0 0 5 0" />
  </svg>
);

export const AlertIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M10.3 3.9 2.6 17.2A1.9 1.9 0 0 0 4.3 20h15.4a1.9 1.9 0 0 0 1.7-2.8L13.7 3.9a1.9 1.9 0 0 0-3.4 0Z" />
    <path d="M12 9v4.2M12 16.8h.01" />
  </svg>
);

export const WindIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M3 8h11a3 3 0 1 0-3-3M3 16h14a3 3 0 1 1-3 3M3 12h18" />
  </svg>
);

export const DropletIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 3.2 7.4 9.1a6 6 0 1 0 9.2 0L12 3.2Z" />
  </svg>
);

export const GaugeIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4 18a8 8 0 1 1 16 0" />
    <path d="M12 18l4-5" />
  </svg>
);

export const EyeIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const ThermometerIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M14 14.8V4.5a2 2 0 1 0-4 0v10.3a4 4 0 1 0 4 0Z" />
  </svg>
);

export const CalendarIcon = (p) => (
  <svg {...base} {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8.5 3v4M15.5 3v4" />
  </svg>
);

export const ChartIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4 20V4M4 20h16" />
    <path d="M7.5 16l3.5-5 3 3 4.5-7" />
  </svg>
);

export const LeafIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4 20c0-8 5-13 16-14 0 11-5 15-12 15H4Z" />
    <path d="M9 15c2-3 4.5-5 8-6.5" />
  </svg>
);

export const PlaneIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M10.5 13.5 3 11V8.5l7.5 1.3V4.2a1.7 1.7 0 0 1 3.4 0v5.6L21 8.5V11l-7.1 2.5.6 5 2.5 1.3V21l-4-1-4 1v-1.2l2.5-1.3.6-5Z" />
  </svg>
);

export const AnchorIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="5" r="2.2" />
    <path d="M12 7.2V21M5 13a7 7 0 0 0 14 0M8.5 10.5h7" />
  </svg>
);

export const BuildingIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4 21V6.5L12 3l8 3.5V21" />
    <path d="M4 21h16M9.5 21v-5h5v5M8.5 9.5h1.5M14 9.5h1.5M8.5 13h1.5M14 13h1.5" />
  </svg>
);

export const LayersIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 3 3 7.5 12 12l9-4.5L12 3Z" />
    <path d="M3 12.5 12 17l9-4.5M3 17 12 21.5 21 17" />
  </svg>
);

export const GlobeIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.4 3.9 5.6 3.9 9s-1.4 6.6-3.9 9c-2.5-2.4-3.9-5.6-3.9-9S9.5 5.4 12 3Z" />
  </svg>
);

export const SparkIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
    <path d="M18.5 16.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" />
  </svg>
);

export const CloseIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const CheckIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4.5 12.5l5 5 10-11" />
  </svg>
);

export const SpeakerIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4v-5Z" />
    <path d="M15.5 9a4.5 4.5 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
  </svg>
);

export const StopIcon = (p) => (
  <svg {...base} {...p}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

export const RefreshIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M20 11a8 8 0 1 0-2.3 6.3M20 5v6h-6" />
  </svg>
);

export const SnowIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" />
  </svg>
);
