/**
 * Contact address shown on the help and legal pages. Set VITE_SUPPORT_EMAIL in
 * the environment; when it is not set, no address is shown anywhere.
 */
const raw = (import.meta.env?.VITE_SUPPORT_EMAIL as string | undefined)?.trim();
export const SUPPORT_EMAIL: string | null = raw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? raw : null;

/** True when this browser holds a saved sign-in. Used only to pick which links to show. */
export function hasSavedSession(): boolean {
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i) ?? "";
      if (/^sb-.+-auth-token$/.test(key) && window.localStorage.getItem(key)) return true;
    }
  } catch {
    // Storage can be unavailable (private mode, blocked cookies); treat as signed out.
  }
  return false;
}
