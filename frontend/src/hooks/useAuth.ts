'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { getAccessToken, setAccessToken, setSessionId, clearTokens } from '@/lib/auth';
import { useAuthContext } from '@/components/AuthProvider';
import type { LoginInput, PendingSession, AuthResult } from '@/types/auth';
import type { User } from '@/types/user';

export function useSIAKADLogin() {
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const { data } = await api.post<{ ok: boolean; data: PendingSession }>(
        '/auth/siakad-login',
        input
      );
      return data.data;
    },
    onSuccess: (data) => {
      setSessionId(data.session_id);
      window.location.href = data.redirect_url;
    },
  });
}

export function useGitHubCallback() {
  const { setAuthenticated } = useAuthContext();

  return useMutation({
    mutationFn: async (params: { code: string; state: string }) => {
      const { data } = await api.post<{ ok: boolean; data: AuthResult }>('/auth/github-callback', {
        session_id: params.state,
        code: params.code,
      });
      return data.data;
    },
    onSuccess: (data) => {
      setAccessToken(data.access_token);
      setAuthenticated(true);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const { setAuthenticated } = useAuthContext();

  return useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout');
    },
    onSuccess: () => {
      clearTokens();
      setAuthenticated(false);
      queryClient.clear();
      window.location.href = '/welcome';
    },
  });
}

export function useCurrentUser() {
  // Use auth context to know when rehydration is complete
  const { isReady, isAuthenticated } = useAuthContext();

  // Only enable the query when auth is ready AND we have a token
  const shouldFetch = isReady && isAuthenticated;

  return useQuery<User>({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const { data } = await api.get<{ ok: boolean; data: User }>('/auth/me');
      return data.data;
    },
    enabled: shouldFetch,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to check if auth is still initializing (rehydrating token).
 * Useful for showing loading states during initial auth check.
 */
export function useAuthReady() {
  return useAuthContext();
}
