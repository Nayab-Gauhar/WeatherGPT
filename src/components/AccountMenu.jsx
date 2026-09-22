/*
 * `Show` rather than `SignedIn` / `SignedOut`.
 *
 * Those older components no longer exist in @clerk/react v6 — importing them
 * type-checks and runs in dev, then fails the production build with
 * MISSING_EXPORT. The current API is a single `Show` with a `when` prop.
 */
import {
  ClerkFailed,
  ClerkLoaded,
  ClerkLoading,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from '@clerk/react';

import { isClerkConfigured } from '../auth/config.js';

/**
 * Sign-in, sign-up and signed-in user controls.
 *
 * Three states are handled explicitly, because the failure mode otherwise is
 * silent. With a mistyped or revoked publishable key, Clerk's script simply never
 * loads, `Show` never resolves, and no control appears at all — leaving someone
 * staring at a header wondering where the sign-in button went. `ClerkFailed`
 * turns that into something diagnosable.
 *
 * Renders nothing when Clerk is not configured: the app is fully usable without
 * an account, so an inert button would be worse than no button.
 */
export default function AccountMenu() {
  if (!isClerkConfigured) return null;

  return (
    <div className="account">
      <ClerkLoading>
        {/* Reserve the space so the header does not jump when Clerk resolves. */}
        <span className="account__loading" aria-hidden="true" />
      </ClerkLoading>

      <ClerkFailed>
        <span className="account__failed" role="status">
          Sign-in unavailable — check VITE_CLERK_PUBLISHABLE_KEY
        </span>
      </ClerkFailed>

      <ClerkLoaded>
        <Show when="signed-out">
          <SignInButton mode="modal">
            <button type="button" className="account__signin">
              Sign in
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button type="button" className="account__signup">
              Sign up
            </button>
          </SignUpButton>
        </Show>

        <Show when="signed-in">
          <UserButton
            afterSignOutUrl="/"
            appearance={{ elements: { avatarBox: { width: 32, height: 32 } } }}
          />
        </Show>
      </ClerkLoaded>
    </div>
  );
}
