/**
 * Account state and per-user data.
 *
 * Gives the rest of the app one interface regardless of whether Clerk is
 * configured or the visitor is signed in, so no component contains a branch on
 * "do we have auth". What changes is only *where* the data lives:
 *
 *   signed in  → Clerk user metadata, so it follows the person across devices
 *   otherwise  → localStorage, so the feature still works for everyone
 *
 * On sign-in, anything saved locally is merged upward rather than discarded —
 * losing a farmer's saved villages because they created an account afterwards
 * would be a poor trade for them.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useUser } from '@clerk/react';

import { isClerkConfigured } from './config.js';
import { getSnapshot, subscribe, write as writeLocal } from './savedPlacesStore.js';

const MAX_SAVED = 24;

/** Store only what is needed to restore a place, not the whole geocoder payload. */
function compact(place) {
  return {
    name: place.name,
    admin1: place.admin1 ?? '',
    country: place.country ?? '',
    countryCode: place.countryCode ?? '',
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: place.timezone ?? 'auto',
    localName: place.localName ?? null,
  };
}

const keyOf = (place) =>
  place ? `${place.name}|${(place.latitude ?? 0).toFixed(2)},${(place.longitude ?? 0).toFixed(2)}` : '';

function mergePlaces(a = [], b = []) {
  const merged = new Map();
  for (const place of [...a, ...b]) {
    if (place?.name && Number.isFinite(place.latitude)) merged.set(keyOf(place), place);
  }
  return [...merged.values()].slice(0, MAX_SAVED);
}

/* ------------------------------------------------------- implementation: local -- */

function useLocalAccount() {
  const savedPlaces = useSyncExternalStore(subscribe, getSnapshot);

  const persist = useCallback((next) => writeLocal(next), []);

  return {
    isConfigured: false,
    isLoaded: true,
    isSignedIn: false,
    user: null,
    savedPlaces,
    syncing: false,
    savePlace: useCallback((place) => persist(mergePlaces(savedPlaces, [compact(place)])), [persist, savedPlaces]),
    removePlace: useCallback(
      (place) => persist(savedPlaces.filter((p) => keyOf(p) !== keyOf(place))),
      [persist, savedPlaces],
    ),
    // Preferences stay device-local without an account; nothing to sync to.
    remotePrefs: null,
    savePrefs: useCallback(() => {}, []),
  };
}

/* ------------------------------------------------------- implementation: Clerk -- */

function useClerkAccount() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [syncing, setSyncing] = useState(false);
  // A "has this run" guard, not rendered state — so a ref, not useState. Using
  // state here would also queue an extra render for no visible change.
  const mergedOnce = useRef(false);

  // Signed-out list comes straight from the external store, so a write in this
  // tab (or another) re-renders without any effect or mirrored state.
  const localPlaces = useSyncExternalStore(subscribe, getSnapshot);

  /*
   * `unsafeMetadata` is the only metadata field writable from the browser, which
   * is what makes per-user storage possible with no backend at all.
   *
   * The name is a warning worth respecting: the user can modify it themselves via
   * the API, so it is appropriate for saved places and display preferences and
   * completely inappropriate for anything granting access or entitlement. Nothing
   * stored here is trusted for authorisation — it is all the user's own
   * convenience data.
   */
  const remotePlaces = useMemo(() => {
    const raw = user?.unsafeMetadata?.savedPlaces;
    return Array.isArray(raw) ? raw : [];
  }, [user?.unsafeMetadata?.savedPlaces]);

  const remotePrefs = useMemo(() => user?.unsafeMetadata?.prefs ?? null, [user?.unsafeMetadata?.prefs]);

  /**
   * Persist a metadata patch. Pure I/O — deliberately touches no React state.
   *
   * Kept separate from `write` so the background merge below can call it from an
   * effect without dragging a state update along. That also makes the split
   * legible to static analysis, rather than relying on a flag the linter cannot
   * follow.
   */
  const persistMetadata = useCallback(
    async (patch) => {
      if (!user) return;
      try {
        await user.update({ unsafeMetadata: { ...user.unsafeMetadata, ...patch } });
      } catch {
        // Offline or rate-limited: the local mirror still holds the user's data,
        // so the action is not lost.
      }
    },
    [user],
  );

  /** Same write, with the visible "syncing" indicator for user-initiated saves. */
  const write = useCallback(
    async (patch) => {
      setSyncing(true);
      try {
        await persistMetadata(patch);
      } finally {
        setSyncing(false);
      }
    },
    [persistMetadata],
  );

  // On first sign-in, lift anything saved while signed out into the account.
  useEffect(() => {
    if (!isSignedIn || !user || mergedOnce.current) return;
    mergedOnce.current = true;

    const local = getSnapshot();
    if (!local.length) return;

    const merged = mergePlaces(remotePlaces, local);
    if (merged.length !== remotePlaces.length) persistMetadata({ savedPlaces: merged });

    /*
     * Keep local storage as a mirror rather than clearing it.
     *
     * Signing out should not empty someone's saved places — they did not ask to
     * delete anything. The account is authoritative while signed in; the mirror
     * is what they fall back to afterwards, and `localPlaces` re-reads it when
     * `isSignedIn` flips.
     */
    writeLocal(merged);
  }, [isSignedIn, user, remotePlaces, persistMetadata]);

  const savedPlaces = isSignedIn ? remotePlaces : localPlaces;

  const savePlace = useCallback(
    (place) => {
      const next = mergePlaces(savedPlaces, [compact(place)]);
      if (isSignedIn) write({ savedPlaces: next });
      else writeLocal(next);
    },
    [isSignedIn, savedPlaces, write],
  );

  const removePlace = useCallback(
    (place) => {
      const next = savedPlaces.filter((p) => keyOf(p) !== keyOf(place));
      if (isSignedIn) write({ savedPlaces: next });
      else writeLocal(next);
    },
    [isSignedIn, savedPlaces, write],
  );

  const savePrefs = useCallback(
    (prefs) => {
      if (isSignedIn) write({ prefs });
    },
    [isSignedIn, write],
  );

  return {
    isConfigured: true,
    isLoaded,
    isSignedIn: Boolean(isSignedIn),
    user: user ?? null,
    savedPlaces,
    syncing,
    savePlace,
    removePlace,
    remotePrefs,
    savePrefs,
  };
}

/*
 * Selected once, at module load.
 *
 * Choosing a hook implementation conditionally is normally a defect, because the
 * number and order of hook calls must be stable across renders. It is safe here
 * precisely because `isClerkConfigured` is derived from a build-time environment
 * variable: it cannot change while the page is open, so whichever function is
 * picked is the only one ever called. The alternative — calling `useUser()` with
 * no provider mounted — throws.
 */
export const useAccount = isClerkConfigured ? useClerkAccount : useLocalAccount;

export { keyOf as placeKey };
