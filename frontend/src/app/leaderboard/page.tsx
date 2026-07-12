'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useAuth';
import { LeaderboardTable } from '@/features/leaderboard/LeaderboardTable';
import { PeriodToggle } from '@/features/leaderboard/PeriodToggle';
import { UserPointsCard } from '@/features/leaderboard/UserPointsCard';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/api';
import type { LeaderboardPeriod, LeaderboardResult, UserPointsSummary } from '@/types/leaderboard';
import {
  Trophy,
  Info,
  GitBranch,
  GitPullRequest,
  MessageSquare,
  FolderGit2,
  Flame,
  GitMerge,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const QUARTER_LABELS: Record<number, string> = {
  1: 'Q1 — Jan to Mar',
  2: 'Q2 — Apr to Jun',
  3: 'Q3 — Jul to Sep',
  4: 'Q4 — Oct to Dec',
};

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<LeaderboardPeriod>('quarterly');
  const [showPointsInfo, setShowPointsInfo] = useState(false);
  const { data: user } = useCurrentUser();

  const {
    data: leaderboard,
    isLoading,
    isError,
  } = useQuery<LeaderboardResult>({
    queryKey: ['leaderboard', period],
    queryFn: async () => {
      const { data } = await api.get<{ ok: boolean; data: LeaderboardResult }>('/leaderboard', {
        params: { period, limit: 50, offset: 0 },
      });
      return data.data;
    },
  });

  const { data: myPoints } = useQuery<UserPointsSummary>({
    queryKey: ['leaderboard', 'me', period],
    queryFn: async () => {
      const { data } = await api.get<{ ok: boolean; data: UserPointsSummary }>('/leaderboard/me', {
        params: { period },
      });
      return data.data;
    },
    enabled: !!user,
  });

  const periodLabel =
    period === 'quarterly'
      ? leaderboard?.quarter
        ? (QUARTER_LABELS[leaderboard.quarter] ?? 'This Quarter')
        : 'This Quarter'
      : 'All Time';

  return (
    <div className="mx-auto max-w-geist-page px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-display-lg text-geist-ink dark:text-white flex items-center gap-3">
              <Trophy className="h-7 w-7 text-amber-500" />
              Leaderboard
            </h1>
            <p className="text-body-sm text-geist-body dark:text-neutral-400 mt-1">
              Top contributors ranked by activity points —{' '}
              <span className="font-medium text-geist-ink dark:text-white">{periodLabel}</span>
            </p>
          </div>
          <PeriodToggle period={period} onChange={setPeriod} />
        </div>

        {/* My points card (authenticated users only) */}
        {user && myPoints && <UserPointsCard summary={myPoints} />}
      </div>

      {/* Point system info */}
      <Card className="mb-6 overflow-hidden">
        <button
          onClick={() => setShowPointsInfo(!showPointsInfo)}
          className="w-full flex items-center justify-between p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <Info className="h-4 w-4 text-geist-mute dark:text-neutral-500 shrink-0" />
            <p className="text-caption font-medium text-geist-ink dark:text-white">
              How points work
            </p>
          </div>
          {showPointsInfo ? (
            <ChevronUp className="h-4 w-4 text-geist-mute dark:text-neutral-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-geist-mute dark:text-neutral-500" />
          )}
        </button>

        {showPointsInfo && (
          <CardContent className="px-4 pb-4 pt-1 border-t border-neutral-100 dark:border-neutral-800/50">
            <div className="space-y-5 mt-2">
              <div>
                <p className="text-caption font-semibold text-geist-ink dark:text-white mb-2">
                  Base Points
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-2 text-caption text-geist-mute dark:text-neutral-400">
                  <span className="inline-flex items-center gap-1.5">
                    <GitBranch className="h-3 w-3 text-blue-500" /> Push: 3 pts{' '}
                    <span className="text-[10px] opacity-70">(capped/day)</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <GitPullRequest className="h-3 w-3 text-violet-500" /> PR Opened: 2 pts
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <GitMerge className="h-3 w-3 text-emerald-500" /> PR Merged: 12 pts
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <FolderGit2 className="h-3 w-3 text-orange-500" /> Showcase: 10 pts
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MessageSquare className="h-3 w-3 text-teal-500" /> Thread: 2 pts
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MessageSquare className="h-3 w-3 text-cyan-500" /> Comment: 1 pt
                  </span>
                  <span className="inline-flex items-center gap-1.5 col-span-2 sm:col-span-1">
                    <Flame className="h-3 w-3 text-orange-500" /> 7-day streak: +20 pts
                  </span>
                </div>
              </div>

              <div>
                <p className="text-caption font-semibold text-geist-ink dark:text-white mb-1.5 flex items-center gap-1.5">
                  🌟 Repo Reputation (Dynamic Scoring)
                </p>
                <p className="text-caption text-geist-mute dark:text-neutral-400 leading-relaxed">
                  Points for Pushes and Merged PRs are dynamically multiplied based on the
                  popularity (GitHub Stars) of the destination repository. Contributing to
                  highly-starred repos yields up to a{' '}
                  <strong className="text-geist-ink dark:text-white font-medium">
                    5.0x multiplier
                  </strong>
                  .
                </p>
              </div>

              <div>
                <p className="text-caption font-semibold text-geist-ink dark:text-white mb-1.5 flex items-center gap-1.5">
                  🛡️ Anti-Spam & Anomaly Detection
                </p>
                <p className="text-caption text-geist-mute dark:text-neutral-400 leading-relaxed">
                  Our system automatically detects unnatural burst activity using Z-Score anomaly
                  detection. Spamming commits will result in point penalties. Quarterly and daily
                  caps are also actively enforced to ensure fair competition.
                </p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Leaderboard table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-geist-md" />
          ))}
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-body-sm text-geist-body dark:text-neutral-400">
              Failed to load leaderboard. Please try again later.
            </p>
          </CardContent>
        </Card>
      ) : (
        <LeaderboardTable entries={leaderboard?.entries ?? []} currentUserId={user?.id} />
      )}
    </div>
  );
}
