'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import type { Thread, Comment } from '@/types/forum';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateCommentForm } from './CreateCommentForm';
import { ArrowLeft, Clock, MessageSquare, MessageCircle } from 'lucide-react';

interface ThreadDetailProps {
  repoId: string;
  threadId: string;
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

export function ThreadDetail({ repoId, threadId }: ThreadDetailProps) {
  const { data, isLoading } = useQuery<{
    thread: Thread;
    comments: Comment[];
  }>({
    queryKey: ['thread', threadId],
    queryFn: async () => {
      const { data } = await api.get<{
        ok: boolean;
        data: { thread: Thread; comments: Comment[] };
      }>(`/threads/${threadId}`);
      return data.data;
    },
  });

  const thread = data?.thread;
  const comments = data?.comments;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  if (!thread) {
    return (
      <Card className="border-dashed border-2 border-gray-200 dark:border-neutral-800">
        <CardContent className="p-10 text-center">
          <div className="h-14 w-14 rounded-full bg-gray-50 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="h-7 w-7 text-gray-300" />
          </div>
          <h3 className="text-base font-medium text-gray-900 dark:text-white mb-1">
            Thread not found
          </h3>
          <p className="text-sm text-gray-500 dark:text-white">
            This thread may have been deleted.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back link */}
      <Link
        href={`/repos/${repoId}/discussions`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-white hover:text-primary-600 dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Discussions
      </Link>

      {/* Thread content */}
      <Card className="overflow-hidden">
        <div className="h-1 gradient-primary" />
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">{thread.title}</CardTitle>
          <div className="flex items-center gap-3 text-sm text-gray-400 dark:text-white">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {getRelativeTime(thread.created_at)}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              {thread.comment_count} comments
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none">
            <p className="text-gray-700 dark:text-white whitespace-pre-wrap leading-relaxed">
              {thread.body}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Comments */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-indigo-600" />
          Comments ({thread.comment_count})
        </h3>
        {comments && comments.length > 0 ? (
          <div className="space-y-3">
            {comments.map((comment, idx) => (
              <Card
                key={comment.id}
                className="hover:border-gray-200 dark:border-neutral-800 transition-colors"
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary-100 to-secondary-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-medium text-primary-700 dark:text-white">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-700 dark:text-white whitespace-pre-wrap">
                        {comment.body}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-white mt-2 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {getRelativeTime(comment.created_at)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed border-2 border-gray-100 dark:border-neutral-800">
            <CardContent className="p-8 text-center">
              <div className="h-12 w-12 rounded-full bg-gray-50 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-3">
                <MessageCircle className="h-6 w-6 text-gray-300" />
              </div>
              <p className="text-sm text-gray-500 dark:text-white">
                No comments yet. Be the first to reply!
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Comment form */}
      <CreateCommentForm repoId={repoId} threadId={threadId} />
    </div>
  );
}
