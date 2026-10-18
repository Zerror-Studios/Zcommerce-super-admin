/**
 * Navigation requests from outside React (review C-M5).
 *
 * The Apollo error link has no router, so when a mutation fails with
 * `MFA_REQUIRED` it asks for `/mfa` here and `AppProviders` navigates.
 */

// ─── State ────────────────────────────────────────────────────────────────

type NavigationListener = (path: string) => void;

const listeners = new Set<NavigationListener>();

// ─── API ──────────────────────────────────────────────────────────────────

/** Subscribe to navigation requests. Returns an unsubscribe function. */
export function onNavigationRequest(listener: NavigationListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Ask the router to go to `path`; a no-op before the app has mounted. */
export function requestNavigation(path: string): void {
  for (const listener of listeners) listener(path);
}
