import { useEffect, useMemo } from 'react';
import Globe from 'react-globe.gl';
import { MeshBasicMaterial, SRGBColorSpace, TextureLoader } from 'three';

import { GLOBE_LABELS } from '../data/places.js';

/**
 * The WebGL globe, isolated into its own module.
 *
 * three.js plus the globe layer is by far the heaviest dependency in the app,
 * so this file is loaded lazily: the conversation — the part that actually
 * answers questions — becomes interactive without waiting for the renderer, and
 * a user in 2D mode or on a low-end device never downloads it at all.
 *
 * Material choice: the sphere uses an *unlit* MeshBasicMaterial instead of the
 * library's default lit material. With a lit material the visible disc is half
 * in shadow and the daylight terminator moves with the camera, which reads as
 * "broken render" on a product whose whole point is clarity. Unlit gives an
 * evenly legible Earth at every angle — the convention every web map follows.
 */
export default function Globe3D({
  globeRef,
  width,
  height,
  isDark,
  countries,
  markers,
  buildMarker,
  onGlobeClick,
  onReady,
}) {
  const textureUrl = isDark ? '/textures/earth-night.jpg' : '/textures/earth-blue-marble.jpg';

  const globeMaterial = useMemo(() => {
    const texture = new TextureLoader().load(textureUrl);
    texture.colorSpace = SRGBColorSpace;
    // Slightly lift the night texture, which is much darker than blue marble.
    return new MeshBasicMaterial({ map: texture, color: isDark ? 0xdcdcdc : 0xffffff });
  }, [textureUrl, isDark]);

  // Free GPU memory when the texture changes (theme switch) or on unmount.
  useEffect(
    () => () => {
      globeMaterial.map?.dispose();
      globeMaterial.dispose();
    },
    [globeMaterial],
  );

  return (
    <Globe
      ref={globeRef}
      width={width}
      height={height}
      backgroundColor="rgba(0,0,0,0)"
      globeMaterial={globeMaterial}
      showAtmosphere
      atmosphereColor={isDark ? '#3b6bb5' : '#9cc4ff'}
      atmosphereAltitude={0.16}
      animateIn={false}
      onGlobeReady={onReady}
      polygonsData={countries ?? []}
      polygonCapColor={() => 'rgba(0,0,0,0)'}
      polygonSideColor={() => 'rgba(0,0,0,0)'}
      polygonStrokeColor={() => (isDark ? 'rgba(150,190,255,0.4)' : 'rgba(255,255,255,0.45)')}
      polygonAltitude={0.004}
      labelsData={GLOBE_LABELS}
      labelLat="lat"
      labelLng="lon"
      labelText="text"
      labelSize={(d) => d.size}
      labelColor={() => 'rgba(255,255,255,0.92)'}
      labelResolution={2}
      labelIncludeDot={false}
      labelAltitude={0.008}
      htmlElementsData={markers}
      htmlLat="lat"
      htmlLng="lng"
      htmlElement={buildMarker}
      htmlTransitionDuration={300}
      onGlobeClick={onGlobeClick}
    />
  );
}
