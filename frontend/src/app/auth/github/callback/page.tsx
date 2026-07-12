'use client';

import { Suspense } from 'react';
import { GitHubCallbackContent } from './content';
import { Skeleton } from '@/components/ui/skeleton';

export default function GitHubCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
          <div className="text-center space-y-4">
            <Skeleton className="h-8 w-48 mx-auto" />
            <p className="text-gray-600 dark:text-white">Loading...</p>
          </div>
        </div>
      }
    >
      <GitHubCallbackContent />
    </Suspense>
  );
}
