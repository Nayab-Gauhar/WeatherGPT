import { ClerkProvider } from '@clerk/react';

import { CLERK_PUBLISHABLE_KEY, isClerkConfigured } from './config.js';

/**
 * Mounts Clerk only when it is configured.
 *
 * This is the important architectural decision in the auth layer. Clerk's
 * provider throws `Missing publishableKey` if instantiated without one, so
 * wrapping the app unconditionally — which is what the setup CLI does — means
 * that a checkout without a key renders a blank page instead of a weather app.
 *
 * Authentication here is genuinely additive: it syncs saved places and
 * preferences across devices. Nothing about answering a weather question depends
 * on knowing who is asking, and a farmer checking whether to spray tomorrow
 * should never be blocked by a sign-in wall. So when no key is present the app
 * runs exactly as before, with saved places kept in local storage.
 */
export default function AuthProvider({ children, theme }) {
  if (!isClerkConfigured) return children;

  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      afterSignOutUrl="/"
      appearance={{
        // Follow the app's own light/dark setting rather than fighting it.
        variables: {
          colorPrimary: '#1a73e8',
          colorBackground: theme === 'dark' ? '#191c20' : '#ffffff',
          colorText: theme === 'dark' ? '#e8eaed' : '#202124',
          colorTextSecondary: theme === 'dark' ? '#9aa0a6' : '#5f6368',
          colorInputBackground: theme === 'dark' ? '#22262b' : '#ffffff',
          colorInputText: theme === 'dark' ? '#e8eaed' : '#202124',
          borderRadius: '10px',
          fontFamily: 'Inter, sans-serif',
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
