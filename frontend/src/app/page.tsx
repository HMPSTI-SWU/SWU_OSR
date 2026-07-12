'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/components/AuthProvider';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Root page — just a skeleton that redirects.
 * Middleware handles most redirects at edge, this is the fallback.
 * Shows skeleton, waits for auth, then goes to /dashboard or /welcome.
 * If nothing happens in 15s, goes to /welcome.
 */
export default function RootPage() {
  const { isReady, isAuthenticated } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!isReady) return;
    router.replace(isAuthenticated ? '/dashboard' : '/welcome');
  }, [isReady, isAuthenticated, router]);

  // 15s timeout fallback
  useEffect(() => {
    const timeout = setTimeout(() => {
      router.replace('/welcome');
    }, 15000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-geist-page px-6 py-8">
      <div className="mb-8 p-6 rounded-geist-md bg-geist-canvas dark:bg-neutral-900">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-geist-sm" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-geist-md" />
        ))}
      </div>
    </div>
  );
}
