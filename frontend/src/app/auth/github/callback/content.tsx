'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGitHubCallback } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';

export function GitHubCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const callback = useGitHubCallback();
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (code && state) {
      calledRef.current = true;
      callback.mutate(
        { code, state },
        {
          onSuccess: () => {
            router.push('/dashboard');
          },
          onError: () => {
            router.push('/login?error=github_callback_failed');
          },
        }
      );
    } else {
      router.push('/login?error=missing_params');
    }
  }, [searchParams, router, callback]);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
      <div className="text-center space-y-4">
        <Skeleton className="h-8 w-48 mx-auto" />
        <p className="text-gray-600 dark:text-white">Completing authentication...</p>
      </div>
    </div>
  );
}
