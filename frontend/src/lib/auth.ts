// Token storage strategy:
// 1. Access token is cached in sessionStorage (survives page refresh within the
//    same tab, cleared on tab close). This avoids a network round-trip on every
//    F5 while keeping the token scoped to the browser tab.
// 2. A non-sensitive "logged_in" hint is stored in localStorage so that even in
//    new tabs (where sessionStorage is empty) the UI can immediately show a
//    loading skeleton instead of the landing page while /auth/refresh resolves.
// 3. The actual security boundary remains the httpOnly refresh_token cookie —
//    even if sessionStorage is tampered with, API calls will fail on invalid JWTs.

let accessToken: string | null = null;

const SESSION_ID_KEY = 'swu_osr_session_id';
const TOKEN_STORAGE_KEY = 'swu_osr_at';
const LOGGED_IN_HINT_KEY = 'swu_osr_logged_in';

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  // Rehydrate from sessionStorage on first call (e.g. after page refresh)
  if (typeof window !== 'undefined') {
    const stored = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) {
      accessToken = stored;
      return stored;
    }
  }
  return null;
}

export function setAccessToken(token: string): void {
  accessToken = token;
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(LOGGED_IN_HINT_KEY, '1');
  }
}

export function getSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(SESSION_ID_KEY);
}

export function setSessionId(sessionId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_ID_KEY, sessionId);
}

/**
 * Returns true if the user has previously logged in (hint only — not a
 * security check). Used to decide whether to show a loading state vs
 * the unauthenticated landing page immediately on mount.
 */
export function hasLoggedInHint(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(LOGGED_IN_HINT_KEY) === '1';
}

export function clearTokens(): void {
  accessToken = null;
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(SESSION_ID_KEY);
  localStorage.removeItem(LOGGED_IN_HINT_KEY);
}

/**
 * Attempt to rehydrate the access token from the server using the
 * httpOnly refresh_token cookie. Call this once on application init
 * when sessionStorage doesn't already have a valid token.
 */
export async function rehydrateToken(): Promise<string | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!res.ok) {
      // Refresh failed — clear the hint so next load doesn't show skeleton
      if (typeof window !== 'undefined') {
        localStorage.removeItem(LOGGED_IN_HINT_KEY);
      }
      return null;
    }
    const data = await res.json();
    const token = data.data?.access_token ?? data.access_token;
    if (token) {
      setAccessToken(token);
      return token;
    }
    return null;
  } catch {
    return null;
  }
}
