'use client';

import * as React from 'react';
import { rehydrateToken, getAccessToken, hasLoggedInHint } from '@/lib/auth';

interface AuthContextValue {
  /** True once the initial token rehydration attempt has completed. */
  isReady: boolean;
  /** True when a valid access token exists in memory. */
  isAuthenticated: boolean;
  /** Call after a successful login to update context state. */
  setAuthenticated: (value: boolean) => void;
}

const AuthContext = React.createContext<AuthContextValue>({
  isReady: false,
  isAuthenticated: false,
  setAuthenticated: () => {},
});

export function useAuthContext() {
  return React.useContext(AuthContext);
}

/**
 * Compute the initial auth state synchronously so the very first CLIENT
 * render already knows if the user is authenticated (from sessionStorage).
 *
 * IMPORTANT: We always start with isReady=false to avoid hydration mismatch
 * (server can't access sessionStorage). The useEffect immediately corrects
 * this on mount — but since both server AND client start with the same
 * initial state, there's no hydration conflict.
 */

/**
 * AuthProvider rehydrates the access token on mount.
 *
 * Priority order:
 * 1. If token already exists in sessionStorage → instant ready on first render.
 * 2. Otherwise, check the httpOnly refresh cookie via /auth/refresh.
 *
 * While waiting for (2), the `hasLoggedInHint()` flag tells consuming
 * components whether the user was previously logged in, so they can show
 * a loading skeleton instead of flashing the unauthenticated landing page.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = React.useState(false);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);

  React.useEffect(() => {
    // Synchronous check: token in sessionStorage?
    const token = getAccessToken();
    if (token) {
      setIsAuthenticated(true);
      setIsReady(true);
      return;
    }

    // No token in memory — try rehydrating from httpOnly cookie
    let mounted = true;
    async function init() {
      const refreshed = await rehydrateToken();
      if (mounted) {
        setIsAuthenticated(!!refreshed);
        setIsReady(true);
      }
    }
    init();
    return () => {
      mounted = false;
    };
  }, []);

  const value = React.useMemo(
    () => ({ isReady, isAuthenticated, setAuthenticated: setIsAuthenticated }),
    [isReady, isAuthenticated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
