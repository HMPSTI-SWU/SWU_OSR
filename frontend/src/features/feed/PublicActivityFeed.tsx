'use client';

import { useEffect, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import api from '@/lib/api';
import type { FeedResponse } from '@/types/activity';
import { ActivityCard } from './ActivityCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Inbox, ArrowRight } from 'lucide-react';
import Link from 'next/link';

/**
 * Public activity feed — displays the global community feed
 * without requiring authentication. No sync button, no auth-dependent features.
 * Uses virtualization to minimize DOM nodes and memory usage.
 */
export function PublicActivityFeed() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, refetch } =
    useInfiniteQuery<FeedResponse>({
      queryKey: ['publicActivityFeed'],
      queryFn: async ({ pageParam }) => {
        const params = pageParam ? { cursor: pageParam, limit: 20 } : { limit: 20 };
        const { data } = await api.get<{ ok: boolean; data: FeedResponse }>('/feed', { params });
        return data.data;
      },
      initialPageParam: '',
      getNextPageParam: (lastPage) => (lastPage.has_more ? lastPage.next_cursor : undefined),
      maxPages: 5, // Only keep last 5 pages in memory to limit RAM usage
    });

  // Virtualizer setup
  const parentRef = useRef<HTMLDivElement>(null);
  const items = data?.pages.flatMap((page) => page.items) ?? [];

  const virtualizer = useVirtualizer({
    count: items.length + (hasNextPage ? 1 : 0),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88,
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const lastItem = virtualItems[virtualItems.length - 1];

  // Auto-fetch next page when scrolling near the end
  useEffect(() => {
    if (!lastItem) return;
    if (lastItem.index >= items.length - 3 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [lastItem, items.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
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
            The community feed will populate as members contribute to open source projects.
          </p>
          <Link href="/login">
            <Button variant="default" size="sm">
              Join the community
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
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
  );
}
