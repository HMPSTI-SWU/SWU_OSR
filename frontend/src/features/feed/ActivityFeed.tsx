'use client';

import { useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import api from '@/lib/api';
import type { FeedResponse } from '@/types/activity';
import { useCurrentUser } from '@/hooks/useAuth';
import { ActivityCard } from './ActivityCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { FolderGit2, RefreshCw, Inbox } from 'lucide-react';

export function ActivityFeed() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, refetch } =
    useInfiniteQuery<FeedResponse>({
      queryKey: ['activityFeed'],
      queryFn: async ({ pageParam }) => {
        const params = pageParam ? { cursor: pageParam, limit: 20 } : { limit: 20 };
        const { data } = await api.get<{ ok: boolean; data: FeedResponse }>('/feed', { params });
        return data.data;
      },
      initialPageParam: '',
      getNextPageParam: (lastPage) => (lastPage.has_more ? lastPage.next_cursor : undefined),
      maxPages: 5, // Only keep last 5 pages in memory to limit RAM usage
    });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{
        ok: boolean;
        data: { synced: number };
      }>('/activity/sync');
      return data.data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['activityFeed'] });
      if (result.synced > 0) {
        toast(`Synced ${result.synced} new activities from GitHub`, 'success');
      } else {
        toast('Already up to date — no new activities found', 'success');
      }
    },
    onError: () => {
      toast('Failed to sync activity from GitHub', 'error');
    },
  });

  // Auto-sync on first load when feed is empty
  const autoSyncRef = useRef(false);
  useEffect(() => {
    if (autoSyncRef.current) return;
    if (isLoading || isError) return;
    const items = data?.pages.flatMap((page) => page.items) ?? [];
    if (items.length === 0 && user && !syncMutation.isPending) {
      autoSyncRef.current = true;
      syncMutation.mutate();
    }
  }, [data, user, isLoading, isError]);

  // Virtualizer setup
  const parentRef = useRef<HTMLDivElement>(null);
  const items = data?.pages.flatMap((page) => page.items) ?? [];

  const virtualizer = useVirtualizer({
    count: items.length + (hasNextPage ? 1 : 0), // +1 for "load more" row
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88, // estimated card height in px
    overscan: 5,
  });

  // Auto-fetch next page when scrolling near the end
  const virtualItems = virtualizer.getVirtualItems();
  const lastItem = virtualItems[virtualItems.length - 1];

  useEffect(() => {
    if (!lastItem) return;
    if (lastItem.index >= items.length - 3 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [lastItem, items.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-geist-md" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="h-12 w-12 rounded-geist-full bg-geist-error-soft dark:bg-neutral-800 flex items-center justify-center mx-auto mb-3">
            <RefreshCw className="h-5 w-5 text-geist-error dark:text-white" />
          </div>
          <p className="text-body-sm text-geist-body dark:text-white mb-4">
            Failed to load activity feed.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="border border-dashed border-geist-hairline dark:border-neutral-700">
        <CardContent className="p-10 text-center">
          <div className="h-12 w-12 rounded-geist-full bg-geist-canvas-soft-2 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
            <Inbox className="h-6 w-6 text-geist-mute dark:text-white" />
          </div>
          <h3 className="text-body-md-strong text-geist-ink dark:text-white mb-1">
            No activity yet.
          </h3>
          <p className="text-body-sm text-geist-body dark:text-white max-w-sm mx-auto mb-6">
            {user
              ? 'Sync your GitHub activity or add repos to your showcase to start tracking contributions.'
              : 'Sign in and add repos to your showcase to start tracking open source contributions.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            {user && (
              <Button
                variant="default"
                size="sm"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
              >
                {syncMutation.isPending ? (
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                )}
                {syncMutation.isPending ? 'Syncing...' : 'Sync GitHub activity'}
              </Button>
            )}
            <Link href={user ? '/showcase' : '/login'}>
              <Button variant="outline" size="sm">
                <FolderGit2 className="mr-1.5 h-3.5 w-3.5" />
                {user ? 'Go to Showcase' : 'Sign In'}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Sync button */}
      {user && (
        <div className="flex justify-end mb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? (
              <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3 w-3" />
            )}
            {syncMutation.isPending ? 'Syncing...' : 'Sync from GitHub'}
          </Button>
        </div>
      )}

      {/* Virtualized feed list */}
      <div ref={parentRef} className="h-[600px] overflow-auto">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map((virtualRow) => {
            const isLoaderRow = virtualRow.index >= items.length;

            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {isLoaderRow ? (
                  <div className="flex justify-center py-4">
                    {isFetchingNextPage ? (
                      <div className="flex items-center gap-2 text-body-sm text-geist-mute">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        Loading...
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => fetchNextPage()}>
                        Load more
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="pb-3">
                    <ActivityCard item={items[virtualRow.index]} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
