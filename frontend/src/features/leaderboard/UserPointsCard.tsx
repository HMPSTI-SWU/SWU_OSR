'use client';

import { Card, CardContent } from '@/components/ui/card';
import type { UserPointsSummary } from '@/types/leaderboard';
import { Trophy, GitBranch, GitPullRequest, MessageSquare, FolderGit2, Flame } from 'lucide-react';

interface UserPointsCardProps {
  summary: UserPointsSummary;
}

export function UserPointsCard({ summary }: UserPointsCardProps) {
  const stats = [
    { icon: GitBranch, label: 'Pushes', value: summary.push_count, color: 'text-blue-500' },
    { icon: GitPullRequest, label: 'PRs', value: summary.pr_count, color: 'text-purple-500' },
    { icon: MessageSquare, label: 'Threads', value: summary.thread_count, color: 'text-green-500' },
    {
      icon: MessageSquare,
      label: 'Comments',
      value: summary.comment_count,
      color: 'text-teal-500',
    },
    {
      icon: FolderGit2,
      label: 'Showcase',
      value: summary.showcase_count,
      color: 'text-orange-500',
    },
  ];

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-body-sm-strong text-geist-ink dark:text-white flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            Your Stats
          </h3>
          <div className="flex items-center gap-2">
            {summary.streak_days >= 7 && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-geist-full bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
                <Flame className="h-3 w-3 text-orange-500" />
                <span className="text-caption text-orange-600 dark:text-orange-400 font-medium">
                  {summary.streak_days}d
                </span>
              </div>
            )}
            <div className="text-right">
              <p className="text-display-sm text-geist-ink dark:text-white">
                {summary.total_points}
              </p>
              <p className="text-caption text-geist-mute dark:text-neutral-500">
                points · rank #{summary.rank}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-3">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="text-center p-2 rounded-geist-sm bg-geist-canvas-soft dark:bg-neutral-800"
              >
                <Icon className={`h-4 w-4 mx-auto mb-1 ${stat.color}`} />
                <p className="text-display-sm text-geist-ink dark:text-white">{stat.value}</p>
                <p className="text-[10px] text-geist-mute dark:text-neutral-500">{stat.label}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
