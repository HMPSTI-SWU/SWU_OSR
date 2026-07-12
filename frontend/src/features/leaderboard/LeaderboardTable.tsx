'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { LeaderboardEntry } from '@/types/leaderboard';
import {
  Trophy,
  Flame,
  GitBranch,
  GitPullRequest,
  MessageSquare,
  Star,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const PAGE_SIZE = 15;

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  currentUserId?: string;
}

function getRankStyle(rank: number) {
  switch (rank) {
    case 1:
      return 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800';
    case 2:
      return 'bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800';
    case 3:
      return 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800';
    default:
      return 'bg-geist-canvas dark:bg-neutral-900 border-geist-hairline dark:border-neutral-800';
  }
}

function getRankBadge(rank: number) {
  switch (rank) {
    case 1:
      return (
        <div className="h-8 w-8 rounded-geist-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
          <Trophy className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
      );
    case 2:
      return (
        <div className="h-8 w-8 rounded-geist-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <Trophy className="h-4 w-4 text-slate-500 dark:text-slate-400" />
        </div>
      );
    case 3:
      return (
        <div className="h-8 w-8 rounded-geist-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
          <Trophy className="h-4 w-4 text-orange-600 dark:text-orange-400" />
        </div>
      );
    default:
      return (
        <div className="h-8 w-8 rounded-geist-full bg-geist-canvas-soft-2 dark:bg-neutral-800 flex items-center justify-center">
          <span className="text-caption-mono text-geist-mute dark:text-neutral-400">{rank}</span>
        </div>
      );
  }
}

export function LeaderboardTable({ entries, currentUserId }: LeaderboardTableProps) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(entries.length / PAGE_SIZE);

  const paginatedEntries = useMemo(
    () => entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [entries, page]
  );

  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="h-12 w-12 rounded-geist-full bg-geist-canvas-soft-2 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
          <Trophy className="h-6 w-6 text-geist-mute dark:text-neutral-500" />
        </div>
        <h3 className="text-body-md-strong text-geist-ink dark:text-white mb-1">
          No rankings yet.
        </h3>
        <p className="text-body-sm text-geist-body dark:text-neutral-400">
          Activity data is being computed. Check back soon!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {paginatedEntries.map((entry) => {
        const isCurrentUser = entry.user_id === currentUserId;
        return (
          <div
            key={entry.user_id}
            className={`flex items-center gap-4 p-4 rounded-geist-md border transition-shadow hover:shadow-geist-2 ${getRankStyle(entry.rank)} ${isCurrentUser ? 'ring-2 ring-geist-link/30 dark:ring-blue-500/30' : ''}`}
          >
            {/* Rank */}
            {getRankBadge(entry.rank)}

            {/* User info */}
            <Link
              href={`/profiles/${entry.alias}`}
              className="flex items-center gap-3 min-w-0 flex-1"
            >
              <Avatar
                src={entry.avatar_url}
                alt={entry.alias}
                fallback={entry.alias.charAt(0).toUpperCase()}
                size="sm"
              />
              <div className="min-w-0">
                <p className="text-body-sm-strong text-geist-ink dark:text-white truncate">
                  {entry.alias}
                  {isCurrentUser && (
                    <span className="ml-2 text-caption text-geist-link dark:text-blue-400">
                      (you)
                    </span>
                  )}
                </p>
                {entry.streak_days >= 7 && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Flame className="h-3 w-3 text-orange-500" />
                    <span className="text-caption text-orange-600 dark:text-orange-400">
                      {entry.streak_days} day streak
                    </span>
                  </div>
                )}
              </div>
            </Link>

            {/* Point breakdown (hidden on mobile) */}
            <div className="hidden sm:flex items-center gap-3">
              <div className="flex items-center gap-1" title="Push points">
                <GitBranch className="h-3.5 w-3.5 text-geist-mute dark:text-neutral-500" />
                <span className="text-caption-mono text-geist-body dark:text-neutral-400">
                  {entry.push_points}
                </span>
              </div>
              <div className="flex items-center gap-1" title="PR points">
                <GitPullRequest className="h-3.5 w-3.5 text-geist-mute dark:text-neutral-500" />
                <span className="text-caption-mono text-geist-body dark:text-neutral-400">
                  {entry.pr_points}
                </span>
              </div>
              <div className="flex items-center gap-1" title="Forum points">
                <MessageSquare className="h-3.5 w-3.5 text-geist-mute dark:text-neutral-500" />
                <span className="text-caption-mono text-geist-body dark:text-neutral-400">
                  {entry.forum_points}
                </span>
              </div>
              <div className="flex items-center gap-1" title="Other points">
                <Star className="h-3.5 w-3.5 text-geist-mute dark:text-neutral-500" />
                <span className="text-caption-mono text-geist-body dark:text-neutral-400">
                  {entry.other_points}
                </span>
              </div>
            </div>

            {/* Total points */}
            <div className="text-right">
              <Badge
                variant={entry.rank <= 3 ? 'success' : 'secondary'}
                className="text-caption-mono font-semibold"
              >
                {entry.total_points} pts
              </Badge>
            </div>
          </div>
        );
      })}

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-caption-mono text-geist-mute dark:text-neutral-400 px-2">
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
