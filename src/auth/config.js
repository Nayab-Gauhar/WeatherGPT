/**
 * Clerk configuration.
 *
 * The publishable key is safe to ship in the client bundle — that is what
 * "publishable" means, and Clerk's own Vite guidance uses a `VITE_` variable for
 * it. The *secret* key is a different matter and must never appear here; nothing
 * in this app needs it, because every Clerk call made from the browser is
 * authenticated by the session, not by a server credential.
 */

export const CLERK_PUBLISHABLE_KEY = import.meta.env?.VITE_CLERK_PUBLISHABLE_KEY ?? '';

/**
 * Whether sign-in is available at all.
 *
 * This is deliberately a plain build-time constant rather than runtime state.
 * `ClerkProvider` throws "Missing publishableKey" when the key is absent, which
 * would take down the entire weather app — so the provider is only mounted when
 * a key exists, and this flag is what the rest of the app branches on. It cannot
 * change while the page is open, which is what makes it safe to use for
 * selecting a hook implementation in `useAccount`.
 */
export const isClerkConfigured = Boolean(CLERK_PUBLISHABLE_KEY);
