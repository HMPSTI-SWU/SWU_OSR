'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import type { ThreadList as ThreadListType } from '@/types/forum';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, Clock, MessageCircle } from 'lucide-react';

interface ThreadListProps {
  repoId: string;
}

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

export function ThreadList({ repoId }: ThreadListProps) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    useInfiniteQuery<ThreadListType>({
      queryKey: ['threads', repoId],
      queryFn: async ({ pageParam }) => {
        const params = pageParam ? { cursor: pageParam, limit: 20 } : { limit: 20 };
        const { data } = await api.get<{ ok: boolean; data: ThreadListType }>(
          `/repos/${repoId}/threads`,
          { params }
        );
        return data.data;
      },
      initialPageParam: '',
      getNextPageParam: (lastPage) => (lastPage.has_more ? lastPage.next_cursor : undefined),
    });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="border-red-100">
        <CardContent className="p-8 text-center">
          <div className="h-12 w-12 rounded-full bg-red-50 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-3">
            <MessageSquare className="h-6 w-6 text-red-400" />
          </div>
          <p className="text-gray-600 dark:text-white">Failed to load threads.</p>
        </CardContent>
      </Card>
    );
  }

  const threads = data?.pages.flatMap((page) => page.threads) ?? [];

  if (threads.length === 0) {
    return (
      <Card className="border-dashed border-2 border-gray-200 dark:border-neutral-800">
        <CardContent className="p-10 text-center">
          <div className="h-14 w-14 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="h-7 w-7 text-indigo-300" />
          </div>
          <h3 className="text-base font-medium text-gray-900 dark:text-white mb-1">
            No discussions yet
          </h3>
          <p className="text-sm text-gray-500 dark:text-white max-w-sm mx-auto">
            Start a new discussion above to collaborate with others on this repository.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {threads.map((thread) => (
        <Link key={thread.id} href={`/repos/${repoId}/discussions/${thread.id}`}>
          <Card className="hover:border-primary-200 hover:shadow-sm transition-all duration-200 cursor-pointer group">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 dark:text-white group-hover:text-primary-700 dark:hover:text-white transition-colors">
                    {thread.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-white mt-1 line-clamp-1">
                    {thread.body}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-gray-400 dark:text-white flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {getRelativeTime(thread.created_at)}
                    </span>
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1 bg-indigo-50 text-indigo-700 border-indigo-200 shrink-0"
                >
                  <MessageSquare className="h-3 w-3" />
                  {thread.comment_count}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
      {hasNextPage && (
        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  );
}
