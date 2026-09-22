/**
 * Local store for saved places.
 *
 * Written as a proper external store so React can subscribe to it with
 * `useSyncExternalStore`. The alternatives were worse: mirroring localStorage
 * into component state means a `setState` inside an effect, and cache-busting a
 * `useMemo` with a version counter is a workaround the dependency linter
 * correctly objects to. localStorage *is* external state, so it should be read
 * as external state.
 *
 * A useful side effect of doing it properly: the native `storage` event gives
 * cross-tab synchronisation for nothing. Saving a place in one tab updates the
 * list in another.
 */

const KEY = 'weathergpt:saved-places';
const EVENT = 'weathergpt:saved-places-changed';

/*
 * Snapshot cache.
 *
 * `getSnapshot` must return a referentially stable value — React compares
 * snapshots with `Object.is`, so parsing the JSON afresh on every call would
 * hand back a new array each time and loop forever. Caching against the raw
 * string means a new array is produced only when the stored text actually
 * changes.
 */
let cachedRaw = null;
let cachedValue = [];

export function getSnapshot() {
  let raw = '[]';
  try {
    raw = localStorage.getItem(KEY) ?? '[]';
  } catch {
    // Storage unavailable (private mode, blocked): behave as if empty.
    return cachedValue;
  }

  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      const parsed = JSON.parse(raw);
      cachedValue = Array.isArray(parsed) ? parsed : [];
    } catch {
      cachedValue = [];
    }
  }
  return cachedValue;
}

export function write(places) {
  try {
    localStorage.setItem(KEY, JSON.stringify(places));
  } catch {
    /* in-memory only for this session */
  }
  // Notify this tab; the `storage` event only fires in *other* tabs.
  window.dispatchEvent(new Event(EVENT));
}

export function subscribe(onChange) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}
