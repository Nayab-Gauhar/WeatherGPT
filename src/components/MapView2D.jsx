import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { clampLatitude, wrapLongitude } from '../utils/coords.js';
import './MapView2D.css';

/**
 * Equirectangular 2D map.
 *
 * A deliberately cheap alternative to the WebGL globe: one raster, plain CSS
 * transforms, no GPU. It is both the low-end-device fallback and the projection
 * people actually prefer for comparing two distant places.
 *
 * Because the source raster is a plate carrée projection, screen position is a
 * linear function of latitude/longitude, so hit-testing a click back to
 * coordinates is exact rather than approximate.
 */
export default function MapView2D({ place, onPickCoordinates, theme = 'light', controlRef }) {
  const hostRef = useRef(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const drag = useRef(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return undefined;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox({ width: r.width, height: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The image keeps a 2:1 ratio and is letterboxed inside the host.
  const imgWidth = Math.min(box.width, box.height * 2);
  const imgHeight = imgWidth / 2;
  const offsetX = (box.width - imgWidth) / 2;
  const offsetY = (box.height - imgHeight) / 2;

  const project = useCallback(
    (lat, lon) => ({
      left: ((lon + 180) / 360) * imgWidth,
      top: ((90 - lat) / 180) * imgHeight,
    }),
    [imgWidth, imgHeight],
  );

  /*
   * Screen position back to a position on Earth.
   *
   * Wrapping matters here: panning the map east past the antimeridian yields
   * pixel positions that map to longitudes beyond 180°, which upstream APIs
   * reject outright. Latitude is clamped instead, since there is nothing beyond
   * the poles to wrap onto.
   */
  const unproject = useCallback(
    (px, py) => ({
      lon: wrapLongitude((px / imgWidth) * 360 - 180),
      lat: clampLatitude(90 - (py / imgHeight) * 180),
    }),
    [imgWidth, imgHeight],
  );

  /*
   * Recentre when the selected place changes.
   *
   * Done as a render-phase adjustment rather than in an effect: the new view is
   * derived from the new prop, so React can compute it in the same pass instead
   * of painting the stale position first and then correcting it.
   */
  const placeKey = place ? `${place.latitude},${place.longitude}` : null;
  const [centredOn, setCentredOn] = useState(null);

  if (placeKey && placeKey !== centredOn && imgWidth > 0) {
    const { left, top } = project(place.latitude, place.longitude);
    const scale = 2.1;
    setCentredOn(placeKey);
    setView({
      scale,
      x: box.width / 2 - (offsetX + left) * scale - offsetX * (1 - scale),
      y: box.height / 2 - (offsetY + top) * scale - offsetY * (1 - scale),
    });
  }

  const handleClick = (event) => {
    if (drag.current?.moved) return;
    const host = hostRef.current.getBoundingClientRect();
    // Undo pan/zoom, then the letterbox offset, to land in image space.
    const px = (event.clientX - host.left - view.x) / view.scale - offsetX;
    const py = (event.clientY - host.top - view.y) / view.scale - offsetY;
    if (px < 0 || py < 0 || px > imgWidth || py > imgHeight) return;
    const { lat, lon } = unproject(px, py);
    onPickCoordinates?.(lat, lon);
  };

  const onPointerDown = (event) => {
    drag.current = { startX: event.clientX, startY: event.clientY, ox: view.x, oy: view.y, moved: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event) => {
    if (!drag.current) return;
    const dx = event.clientX - drag.current.startX;
    const dy = event.clientY - drag.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.current.moved = true;
    setView((v) => ({ ...v, x: drag.current.ox + dx, y: drag.current.oy + dy }));
  };

  const onPointerUp = () => {
    // Keep `moved` readable by the click handler that fires straight after.
    const wasMoved = drag.current?.moved;
    setTimeout(() => {
      drag.current = wasMoved ? { moved: false } : null;
    }, 0);
  };

  /*
   * Zoom around the viewport centre rather than the origin, so the feature the
   * user is looking at stays put. Exposed imperatively because the buttons live
   * in the parent's control cluster, shared with the 3D globe.
   */
  const zoomBy = useCallback(
    (factor) => {
      setView((v) => {
        const scale = Math.min(6, Math.max(1, v.scale * factor));
        if (scale === v.scale) return v;
        const cx = box.width / 2;
        const cy = box.height / 2;
        const ratio = scale / v.scale;
        return {
          scale,
          x: cx - (cx - v.x) * ratio,
          y: cy - (cy - v.y) * ratio,
        };
      });
    },
    [box.width, box.height],
  );

  useImperativeHandle(controlRef, () => ({ zoomBy }), [zoomBy]);

  const onWheel = (event) => {
    event.preventDefault();
    setView((v) => {
      const scale = Math.min(6, Math.max(1, v.scale * (event.deltaY < 0 ? 1.15 : 0.87)));
      return { ...v, scale };
    });
  };

  const marker = place && imgWidth ? project(place.latitude, place.longitude) : null;

  return (
    <div
      className={`map2d${theme === 'dark' ? ' map2d--dark' : ''}`}
      ref={hostRef}
      onClick={handleClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      role="presentation"
    >
      <div
        className="map2d__pane"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
      >
        <div
          className="map2d__image"
          style={{
            width: imgWidth,
            height: imgHeight,
            left: offsetX,
            top: offsetY,
            backgroundImage: `url(${theme === 'dark' ? '/textures/earth-night.jpg' : '/textures/earth-blue-marble.jpg'})`,
          }}
        >
          {/* Graticule every 30° — helps read position without clutter. */}
          <svg className="map2d__grid" viewBox="0 0 360 180" preserveAspectRatio="none" aria-hidden="true">
            {[30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((x) => (
              <line key={`v${x}`} x1={x} y1="0" x2={x} y2="180" />
            ))}
            {[30, 60, 120, 150].map((y) => (
              <line key={`h${y}`} x1="0" y1={y} x2="360" y2={y} />
            ))}
            <line className="map2d__equator" x1="0" y1="90" x2="360" y2="90" />
          </svg>

          {marker && (
            <div
              className="map2d__marker"
              style={{ left: marker.left, top: marker.top, transform: `translate(-50%, -100%) scale(${1 / view.scale})` }}
            >
              <svg viewBox="0 0 24 34" width="24" height="34" aria-hidden="true">
                <path d="M12 0a12 12 0 0 0-12 12c0 8.4 12 22 12 22s12-13.6 12-22A12 12 0 0 0 12 0Z" fill="#E8453C" />
                <circle cx="12" cy="12" r="4.6" fill="#fff" />
              </svg>
              <span className="map2d__label">{place.name}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
