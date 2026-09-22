import { useEffect, useMemo, useRef, useState, useCallback, lazy, Suspense } from 'react';

import { t } from '../i18n/index.js';
import { clampLatitude, wrapLongitude } from '../utils/coords.js';
import { PlusIcon, MinusIcon, LocateIcon, GlobeIcon, LayersIcon } from './Icons.jsx';
import MapView2D from './MapView2D.jsx';
import './GlobeView.css';

// three.js ships in its own chunk, fetched only when 3D is actually shown.
const Globe3D = lazy(() => import('./Globe3D.jsx'));

const MIN_ALTITUDE = 0.32;
const MAX_ALTITUDE = 3.2;

/**
 * Framing. At altitude 1.5 with the renderer's 50° field of view the globe
 * fills roughly 85% of the panel height — large enough to read coastlines,
 * with enough margin that the marker label never clips at the edge.
 */
const DEFAULT_POV = { lat: 20, lng: 78, altitude: 1.7 };
const FOCUS_ALTITUDE = 1.55;

/**
 * Respect the OS "reduce motion" setting for the parts of this component that
 * CSS cannot reach: the globe's idle rotation and the camera fly-to animation
 * are driven by WebGL, so the media query has to be read in JavaScript.
 */
function prefersReducedMotion() {
  return typeof window !== 'undefined'
    ? window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
    : false;
}

/** WebGL can be unavailable (old hardware, disabled GPU) — detect, don't crash. */
function detectWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl')),
    );
  } catch {
    return false;
  }
}

/**
 * The left-hand geospatial panel.
 *
 * 3D is a textured WebGL globe (react-globe.gl / three.js); 2D is an
 * equirectangular projection that costs no GPU — the fallback for low-end
 * devices, which matters for the rural-accessibility goal. The marker, click
 * targeting and zoom controls behave identically in both.
 */
export default function GlobeView({
  place,
  mode,
  onModeChange,
  onPickCoordinates,
  onUseMyLocation,
  lang = 'en',
  theme = 'light',
  locating = false,
}) {
  const wrapRef = useRef(null);
  const globeRef = useRef(null);
  const map2dRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [countries, setCountries] = useState(null);
  const [webgl] = useState(detectWebGL);
  // Camera altitude is the renderer's business, not React's: nothing in the
  // markup depends on it, so it lives in a ref and never triggers a re-render.
  const altitudeRef = useRef(DEFAULT_POV.altitude);
  // The globe loads lazily, so a place can be selected before the renderer
  // exists. This flag lets the camera effect re-run once it is ready.
  const [globeReady, setGlobeReady] = useState(false);

  const effectiveMode = webgl ? mode : '2d';

  /* --------------------------------------------------------------- sizing -- */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      setSize({ width: Math.round(rect.width), height: Math.round(rect.height) });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* ------------------------------------------------------ country borders -- */
  useEffect(() => {
    let cancelled = false;
    fetch('/data/countries.geojson')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json?.features) setCountries(json.features);
      })
      .catch(() => {
        /* borders are decorative — the globe works without them */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* ----------------------------------------------- camera + auto-rotation -- */
  const applyPov = useCallback((lat, lng, alt, ms = 1200) => {
    globeRef.current?.pointOfView({ lat, lng, altitude: alt }, ms);
  }, []);

  // Frame the globe as soon as the renderer exists, then fly to each new place.
  useEffect(() => {
    if (effectiveMode !== '3d' || !globeReady || !globeRef.current) return;

    if (place) {
      altitudeRef.current = FOCUS_ALTITUDE;
      applyPov(place.latitude, place.longitude, FOCUS_ALTITUDE, prefersReducedMotion() ? 0 : 1600);
    } else {
      altitudeRef.current = DEFAULT_POV.altitude;
      applyPov(DEFAULT_POV.lat, DEFAULT_POV.lng, DEFAULT_POV.altitude, 0);
    }
  }, [place, effectiveMode, globeReady, applyPov]);

  // Idle rotation only while no location is selected.
  useEffect(() => {
    if (effectiveMode !== '3d') return undefined;
    const controls = globeRef.current?.controls?.();
    if (!controls) return undefined;

    controls.autoRotate = !place && !prefersReducedMotion();
    controls.autoRotateSpeed = 0.35;
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.minDistance = 120;
    controls.maxDistance = 800;

    const stop = () => {
      controls.autoRotate = false;
    };
    const dom = controls.domElement;
    dom?.addEventListener('pointerdown', stop);
    dom?.addEventListener('wheel', stop, { passive: true });

    return () => {
      dom?.removeEventListener('pointerdown', stop);
      dom?.removeEventListener('wheel', stop);
    };
  }, [effectiveMode, place, size.width]);

  const zoom = (factor) => {
    if (effectiveMode === '2d') {
      // Buttons and wheel must agree: > 1 means "closer" for the flat map,
      // whereas for the globe a *smaller* altitude means closer.
      map2dRef.current?.zoomBy(factor < 1 ? 1.35 : 1 / 1.35);
      return;
    }
    const pov = globeRef.current?.pointOfView() ?? DEFAULT_POV;
    const current = pov.altitude ?? altitudeRef.current;
    const next = Math.min(MAX_ALTITUDE, Math.max(MIN_ALTITUDE, current * factor));
    altitudeRef.current = next;
    applyPov(pov.lat, pov.lng, next, 400);
  };

  /* ------------------------------------------------------------- marker -- */
  const markers = useMemo(
    () => (place ? [{ lat: place.latitude, lng: place.longitude, name: place.name }] : []),
    [place],
  );

  const buildMarker = useCallback((d) => {
    const el = document.createElement('div');
    el.className = 'globe-marker';
    el.innerHTML = `
      <svg class="globe-marker__pin" viewBox="0 0 24 34" width="26" height="36" aria-hidden="true">
        <path d="M12 0a12 12 0 0 0-12 12c0 8.4 12 22 12 22s12-13.6 12-22A12 12 0 0 0 12 0Z" fill="#E8453C"/>
        <path d="M12 0a12 12 0 0 0-12 12c0 8.4 12 22 12 22V0Z" fill="#F05A50"/>
        <circle cx="12" cy="12" r="4.6" fill="#fff"/>
      </svg>
      <span class="globe-marker__label"></span>
    `;
    el.querySelector('.globe-marker__label').textContent = d.name;
    return el;
  }, []);

  /* --------------------------------------------------------------- render -- */
  const ready = size.width > 0 && size.height > 0;
  const isDark = theme === 'dark';

  return (
    <section className="globe" aria-label="Interactive weather map">
      <div className="globe__stage" ref={wrapRef}>
        {effectiveMode === '3d' && ready && (
          <Suspense fallback={<div className="globe__loading" />}>
            <Globe3D
              globeRef={globeRef}
              width={size.width}
              height={size.height}
              isDark={isDark}
              countries={countries}
              markers={markers}
              buildMarker={buildMarker}
              // Normalised before leaving the renderer: three.js can report a
              // longitude slightly outside ±180 at the seam.
              onGlobeClick={({ lat, lng }) =>
                onPickCoordinates?.(clampLatitude(lat), wrapLongitude(lng))
              }
              onReady={() => setGlobeReady(true)}
            />
          </Suspense>
        )}

        {effectiveMode === '2d' && (
          <MapView2D
            place={place}
            onPickCoordinates={onPickCoordinates}
            theme={theme}
            controlRef={map2dRef}
          />
        )}

        {!ready && <div className="globe__loading" />}
      </div>

      {/* Zoom + locate controls */}
      <div className="globe__controls">
        <div className="globe__zoom">
          <button
            type="button"
            className="globe__btn"
            onClick={() => zoom(0.65)}
            aria-label={t('zoomIn', lang)}
            title={t('zoomIn', lang)}
          >
            <PlusIcon width={18} height={18} />
          </button>
          <button
            type="button"
            className="globe__btn"
            onClick={() => zoom(1.55)}
            aria-label={t('zoomOut', lang)}
            title={t('zoomOut', lang)}
          >
            <MinusIcon width={18} height={18} />
          </button>
        </div>
        <button
          type="button"
          className={`globe__btn globe__btn--locate${locating ? ' is-busy' : ''}`}
          onClick={onUseMyLocation}
          aria-label={t('myLocation', lang)}
          title={t('myLocation', lang)}
        >
          <LocateIcon width={18} height={18} />
        </button>
      </div>

      {/* 2D / 3D switch */}
      <div className="globe__modes" role="group" aria-label="Map projection">
        <button
          type="button"
          className={`globe__mode${effectiveMode === '2d' ? ' is-active' : ''}`}
          onClick={() => onModeChange('2d')}
          aria-pressed={effectiveMode === '2d'}
        >
          <LayersIcon width={14} height={14} />
          {t('mode2D', lang)}
        </button>
        <button
          type="button"
          className={`globe__mode${effectiveMode === '3d' ? ' is-active' : ''}`}
          onClick={() => onModeChange('3d')}
          aria-pressed={effectiveMode === '3d'}
          disabled={!webgl}
          title={webgl ? undefined : 'WebGL is unavailable on this device'}
        >
          <GlobeIcon width={14} height={14} />
          {t('mode3D', lang)}
        </button>
      </div>

      <p className="globe__hint">Click the map to query any point</p>
    </section>
  );
}
