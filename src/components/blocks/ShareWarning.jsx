import { useState } from 'react';

import { SendIcon, CheckIcon } from '../Icons.jsx';
import { composeWarningSms, smsSegments, smsHref, copyToClipboard } from '../../services/smsShare.js';

/**
 * Forward a warning by SMS.
 *
 * Dissemination is the point of a warning system, and this is the part that works
 * with no backend and no telecom registration: the message is handed to the
 * user's own SMS app, pre-filled, for them to send to whoever needs it. It
 * reaches a feature phone with no data connection.
 *
 * The segment count is shown rather than hidden because it is real information —
 * a Hindi warning is limited to 70 characters per segment against English's 160,
 * and a message split into several parts can arrive out of order.
 */
export default function ShareWarning({ place, warnings, lang }) {
  const [copied, setCopied] = useState(false);

  if (!warnings?.count) return null;

  const body = composeWarningSms({ place, warnings, lang });
  const { segments, length, encoding } = smsSegments(body);

  const onCopy = async () => {
    if (await copyToClipboard(body)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  return (
    <div className="share">
      <a
        className="share__sms"
        href={smsHref(body)}
        // Desktop browsers often have no sms: handler; copying is the fallback
        // there and harmless on mobile, where the link takes over.
        onClick={onCopy}
      >
        <SendIcon width={14} height={14} />
        Forward by SMS
      </a>

      <button type="button" className="share__copy" onClick={onCopy}>
        {copied ? (
          <>
            <CheckIcon width={13} height={13} />
            Copied
          </>
        ) : (
          'Copy text'
        )}
      </button>

      <span
        className={`share__meta${segments > 2 ? ' is-long' : ''}`}
        title={`${length} characters, ${encoding} encoding`}
      >
        {segments} SMS{segments > 1 ? ' parts' : ''}
      </span>
    </div>
  );
}
