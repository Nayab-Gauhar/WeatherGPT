import { useEffect, useRef, useState } from 'react';

import { PinIcon, CloseIcon, CheckIcon } from './Icons.jsx';
import { placeKey } from '../auth/useAccount.js';
import { placeLabel } from '../utils/format.js';

/**
 * Saved places — the reason this app has accounts at all.
 *
 * A user who checks the same three villages every morning should not retype
 * them, and signing in makes that list follow them to another device. Without an
 * account the same feature works from local storage, so the value is not gated
 * behind sign-up.
 */
export default function SavedPlaces({
  place,
  savedPlaces,
  onSave,
  onRemove,
  onSelect,
  isSignedIn,
  isConfigured,
  syncing,
  lang,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const currentSaved = place
    ? savedPlaces.some((p) => placeKey(p) === placeKey(place))
    : false;

  return (
    <div className="saved" ref={ref}>
      {/* Star the place currently under discussion. */}
      {place && (
        <button
          type="button"
          className={`icon-btn saved__toggle${currentSaved ? ' is-saved' : ''}`}
          onClick={() => (currentSaved ? onRemove(place) : onSave(place))}
          aria-pressed={currentSaved}
          aria-label={currentSaved ? `Remove ${place.name} from saved places` : `Save ${place.name}`}
          title={currentSaved ? `Remove ${place.name}` : `Save ${place.name}`}
        >
          <PinIcon width={18} height={18} />
        </button>
      )}

      <button
        type="button"
        className="icon-btn saved__open"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Saved places (${savedPlaces.length})`}
        title={`Saved places (${savedPlaces.length})`}
      >
        <span className="saved__count">{savedPlaces.length}</span>
      </button>

      {open && (
        <div className="saved__panel" role="dialog" aria-label="Saved places">
          <header className="saved__head">
            <h3>Saved places</h3>
            {syncing && <span className="saved__syncing">syncing…</span>}
          </header>

          {savedPlaces.length === 0 ? (
            <p className="saved__empty">
              No saved places yet. Ask about somewhere, then use the pin to keep it here.
            </p>
          ) : (
            <ul className="saved__list">
              {savedPlaces.map((saved) => (
                <li key={placeKey(saved)}>
                  <button
                    type="button"
                    className="saved__item"
                    onClick={() => {
                      onSelect(saved);
                      setOpen(false);
                    }}
                  >
                    <PinIcon width={14} height={14} />
                    <span>{placeLabel(saved, lang)}</span>
                  </button>
                  <button
                    type="button"
                    className="saved__remove"
                    onClick={() => onRemove(saved)}
                    aria-label={`Remove ${saved.name}`}
                    title={`Remove ${saved.name}`}
                  >
                    <CloseIcon width={13} height={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/*
            Say plainly where the list is stored. A user deciding whether to
            create an account deserves to know what it actually buys them.
          */}
          {isConfigured && (
            <p className="saved__note">
              {isSignedIn ? (
                <>
                  <CheckIcon width={12} height={12} />
                  Synced to your account — available on any device.
                </>
              ) : (
                'Stored on this device. Sign in to sync across devices; anything saved now carries over.'
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
