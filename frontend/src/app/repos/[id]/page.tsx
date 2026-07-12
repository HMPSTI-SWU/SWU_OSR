'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useCurrentUser } from '@/hooks/useAuth';
import api from '@/lib/api';
import type { ShowcaseRepo } from '@/types/showcase';
import type { ActivityItem } from '@/types/activity';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  ExternalLink,
  FolderGit2,
  MessageSquare,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Tag,
  Code2,
  Clock,
  RefreshCw,
} from 'lucide-react';

interface RepoPageProps {
  params: { id: string };
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

function getEventConfig(eventType: string) {
  switch (eventType) {
    case 'push':
      return {
        icon: <GitCommit className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />,
        bg: 'bg-emerald-50 dark:bg-emerald-950/40',
        border: 'border-emerald-200 dark:border-emerald-800/60',
        label: 'Pushed',
        labelColor: 'text-emerald-700 dark:text-emerald-400',
      };
    case 'pull_request':
      return {
        icon: <GitPullRequest className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />,
        bg: 'bg-purple-50 dark:bg-purple-950/40',
        border: 'border-purple-200 dark:border-purple-800/60',
        label: 'PR',
        labelColor: 'text-purple-700 dark:text-purple-400',
      };
    case 'release':
      return {
        icon: <Tag className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />,
        bg: 'bg-blue-50 dark:bg-blue-950/40',
        border: 'border-blue-200 dark:border-blue-800/60',
        label: 'Release',
        labelColor: 'text-blue-700 dark:text-blue-400',
      };
    default:
      return {
        icon: <GitBranch className="h-3.5 w-3.5 text-gray-600 dark:text-gray-400" />,
        bg: 'bg-gray-50 dark:bg-neutral-800/60',
        border: 'border-gray-200 dark:border-neutral-700',
        label: 'Activity',
        labelColor: 'text-gray-600 dark:text-gray-400',
      };
  }
}

export default function RepoDetailPage({ params }: RepoPageProps) {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  // Fetch showcase repo details from the public endpoint
  const { data: repo, isLoading } = useQuery<ShowcaseRepo>({
    queryKey: ['publicRepo', params.id],
    queryFn: async () => {
      const { data } = await api.get<{ ok: boolean; data: ShowcaseRepo }>(`/repos/${params.id}`);
      return data.data;
    },
  });

  // Fetch recent activity for this repo from the dedicated endpoint
  const { data: feedData, isLoading: activityLoading } = useQuery<{ items: ActivityItem[] }>({
    queryKey: ['repoActivity', params.id],
    queryFn: async () => {
      const { data } = await api.get<{ ok: boolean; data: { items: ActivityItem[] } }>(
        `/repos/${params.id}/activity`,
        { params: { limit: 20 } }
      );
      return data.data;
    },
  });

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const { data } = await api.post<{ ok: boolean; data: { synced: number } }>('/activity/sync');
      const count = data.data.synced;
      setSyncResult(count > 0 ? `Synced ${count} activities!` : 'Already up to date.');
      // Refetch activity after sync
      queryClient.invalidateQueries({ queryKey: ['repoActivity', params.id] });
    } catch {
      setSyncResult('Failed to sync. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const repoActivities = feedData?.items ?? [];

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!repo) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Card>
          <CardContent className="p-12 text-center">
            <div className="h-14 w-14 rounded-full bg-gray-50 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
              <FolderGit2 className="h-7 w-7 text-gray-300" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
              Repository not found
            </h3>
            <p className="text-sm text-gray-500 dark:text-white mb-4">
              This repository is not in your showcase or does not exist.
            </p>
            <Link href="/showcase">
              <Button variant="outline" size="sm">
                Back to Showcase
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const githubUrl = repo.html_url || `https://github.com/${repo.repo_full_name}`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Back link */}
      <Link
        href={user ? '/dashboard' : '/feed'}
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-white hover:text-primary-600 dark:hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {user ? 'Back to Dashboard' : 'Back to Feed'}
      </Link>

      {/* Repo Header */}
      <Card className="overflow-hidden mb-6">
        <div className="h-2 gradient-primary" />
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <FolderGit2 className="h-5 w-5 text-primary-600 dark:text-white" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {repo.repo_name}
                </h1>
              </div>
              <p className="text-gray-600 dark:text-white mb-4">
                {repo.description ||
                  'No description provided. You can add one from the Showcase page.'}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {repo.language && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Code2 className="h-3 w-3" />
                    {repo.language}
                  </Badge>
                )}
                <Badge className="bg-primary-50 text-primary-700 dark:bg-neutral-800 dark:text-white border-primary-200">
                  {repo.academic_tag.replace('_', ' ')}
                </Badge>
                <span className="text-xs text-gray-400 dark:text-white">{repo.repo_full_name}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <a href={githubUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" className="gap-1.5 gradient-primary text-white border-0">
                  <ExternalLink className="h-3.5 w-3.5" />
                  View on GitHub
                </Button>
              </a>
              <Link href={`/repos/${repo.id}/discussions`}>
                <Button size="sm" variant="outline" className="gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Discussions
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity (2/3) */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-green-600" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {repoActivities.length > 0 ? (
                <div className="space-y-2.5">
                  {repoActivities.map((activity) => {
                    const config = getEventConfig(activity.event_type);
                    return (
                      <div
                        key={activity.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${config.bg} ${config.border}`}
                      >
                        <div className="mt-0.5 shrink-0">{config.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span
                              className={`text-[10px] font-semibold uppercase tracking-wide ${config.labelColor}`}
                            >
                              {config.label}
                            </span>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500">•</span>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" />
                              {getRelativeTime(activity.created_at)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2 leading-relaxed">
                            {activity.summary}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="h-12 w-12 rounded-full bg-gray-50 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-3">
                    <GitBranch className="h-6 w-6 text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-white">
                    No recent activity recorded for this repository.
                  </p>
                  <p className="text-xs text-gray-400 dark:text-white mt-1 mb-3">
                    Click below to fetch commits and events from GitHub.
                  </p>
                  <Button
                    size="sm"
                    onClick={handleSync}
                    disabled={syncing}
                    className="gap-1.5 gradient-primary text-white border-0"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Syncing...' : 'Sync GitHub Activity'}
                  </Button>
                  {syncResult && (
                    <p className="text-xs text-green-600 mt-2 font-medium">{syncResult}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar (1/3) */}
        <div className="space-y-4">
          {/* Repo Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Repository Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Full Name</span>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
                  {repo.repo_full_name}
                </span>
              </div>
              {repo.language && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Language</span>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
                    {repo.language}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Tag</span>
                <Badge className="text-[10px] bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                  {repo.academic_tag.replace('_', ' ')}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Added</span>
                <span className="text-xs text-gray-700 dark:text-gray-200">
                  {new Date(repo.created_at).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Open on GitHub
              </a>
              <a
                href={`${githubUrl}/issues`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                <MessageSquare className="h-4 w-4" />
                GitHub Issues
              </a>
              <a
                href={`${githubUrl}/pulls`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                <GitPullRequest className="h-4 w-4" />
                Pull Requests
              </a>
              <Link
                href={`/repos/${repo.id}/discussions`}
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                <MessageSquare className="h-4 w-4" />
                Forum Discussions
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
