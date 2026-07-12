'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { PublicActivityFeed } from '@/features/feed/PublicActivityFeed';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar } from '@/components/ui/avatar';
import api from '@/lib/api';
import { Activity, Users, FolderGit2, TrendingUp, Code2, ArrowRight } from 'lucide-react';

// --- Types ---
interface CommunityStats {
  total_members: number;
  total_repos: number;
  total_activities: number;
  active_today: number;
  top_languages: string[];
  commits_this_week: number;
}

interface PopularRepo {
  id: string;
  repo_name: string;
  repo_full_name: string;
  description: string;
  language: string;
  html_url: string;
  academic_tag: string;
  owner_alias: string;
  owner_avatar: string;
  activity_count: number;
}

/**
 * Public Feed page — accessible to everyone (both authenticated and unauthenticated).
 * Shows community stats, popular repos, and the global activity feed.
 * No redirect — this page is always viewable.
 */
export default function FeedPage() {
  const { data: stats } = useQuery<CommunityStats>({
    queryKey: ['communityStats'],
    queryFn: async () => {
      const { data } = await api.get<{ ok: boolean; data: CommunityStats }>('/stats');
      return data.data;
    },
  });

  const { data: popularRepos } = useQuery<PopularRepo[]>({
    queryKey: ['popularRepos'],
    queryFn: async () => {
      const { data } = await api.get<{ ok: boolean; data: PopularRepo[] }>('/repos/popular');
      return data.data;
    },
  });

  const { data: membersData } = useQuery<{
    members: Array<{
      id: string;
      alias: string;
      avatar_url: string;
      github_username: string;
    }>;
  }>({
    queryKey: ['membersPreview'],
    queryFn: async () => {
      const { data } = await api.get<{
        ok: boolean;
        data: {
          members: Array<{
            id: string;
            alias: string;
            avatar_url: string;
            github_username: string;
          }>;
          total: number;
        };
      }>('/members');
      return data.data;
    },
  });

  return (
    <div className="mx-auto max-w-geist-page px-6 py-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-display-md text-geist-ink dark:text-white mb-2">Community Feed</h1>
        <p className="text-body-md text-geist-body dark:text-gray-300">
          See what the STMIK Widya Utama open source community is building.
        </p>
      </div>

      {/* Community Stats */}
      <div className="mb-8">
        <CommunityStatsBar stats={stats} />
      </div>

      {/* Main content grid: Feed + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Feed (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Popular Repos */}
          <PopularReposSection repos={popularRepos} />

          {/* Activity Feed */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-body-sm-strong text-geist-ink dark:text-white flex items-center gap-2">
                <Activity className="h-4 w-4 text-geist-mute dark:text-gray-400" />
                Recent activity
              </h2>
            </div>
            <PublicActivityFeed />
          </section>
        </div>

        {/* Right sidebar (1/3) */}
        <div className="space-y-4">
          {/* Trending Languages */}
          {stats && stats.top_languages.length > 0 && (
            <TrendingLanguages languages={stats.top_languages} />
          )}

          {/* Community Members */}
          <ActiveMembersSection members={membersData?.members} />

          {/* CTA Card */}
          <div className="rounded-geist-md bg-geist-primary dark:bg-white p-5 text-center">
            <h3 className="text-body-sm-strong text-geist-on-primary dark:text-black mb-2">
              Join the community
            </h3>
            <p className="text-caption text-geist-on-primary/70 dark:text-black/60 mb-4">
              Showcase your open source projects and build your portfolio.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-geist-sm bg-geist-canvas dark:bg-black text-body-sm-strong text-geist-ink dark:text-white hover:bg-geist-canvas-soft dark:hover:bg-neutral-900 transition-colors"
            >
              Get Started
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

function CommunityStatsBar({ stats }: { stats: CommunityStats | undefined }) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-geist-md" />
        ))}
      </div>
    );
  }

  const items = [
    { icon: Users, label: 'Members', value: stats.total_members },
    { icon: FolderGit2, label: 'Repositories', value: stats.total_repos },
    { icon: Activity, label: 'This week', value: stats.commits_this_week },
    { icon: TrendingUp, label: 'Active today', value: stats.active_today },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className="rounded-geist-md bg-geist-canvas dark:bg-neutral-900 geist-level-2 p-4"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-geist-sm bg-geist-canvas-soft-2 dark:bg-neutral-800 flex items-center justify-center">
                <Icon className="h-4 w-4 text-geist-ink dark:text-white" />
              </div>
              <div>
                <p className="text-display-sm text-geist-ink dark:text-white">{item.value}</p>
                <p className="text-caption text-geist-mute dark:text-gray-400">{item.label}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PopularReposSection({ repos }: { repos: PopularRepo[] | undefined }) {
  if (!repos || repos.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-body-sm-strong text-geist-ink dark:text-white flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-geist-mute dark:text-gray-400" />
          Popular repositories
        </h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {repos.slice(0, 3).map((repo) => (
          <Link key={repo.id} href={`/repos/${repo.id}`} className="group">
            <Card className="h-full transition-shadow hover:shadow-geist-3">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FolderGit2 className="h-4 w-4 text-geist-mute dark:text-gray-400 shrink-0" />
                    <span className="text-body-sm-strong text-geist-ink dark:text-white truncate group-hover:text-geist-link dark:group-hover:text-primary-400 transition-colors">
                      {repo.repo_name}
                    </span>
                  </div>
                  {repo.activity_count > 0 && (
                    <Badge variant="success" className="text-[10px] shrink-0">
                      {repo.activity_count} activities
                    </Badge>
                  )}
                </div>
                <p className="text-caption text-geist-mute dark:text-gray-400 line-clamp-2 mb-3">
                  {repo.description || 'No description'}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {repo.language && (
                      <Badge variant="secondary" className="text-[10px]">
                        {repo.language}
                      </Badge>
                    )}
                    <Badge variant="default" className="text-[10px]">
                      {repo.academic_tag.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Avatar
                      src={repo.owner_avatar}
                      alt={repo.owner_alias}
                      fallback={repo.owner_alias.charAt(0).toUpperCase()}
                      size="sm"
                      className="h-5 w-5"
                    />
                    <span className="text-caption text-geist-mute dark:text-gray-400">
                      {repo.owner_alias}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}

function TrendingLanguages({ languages }: { languages: string[] }) {
  if (!languages || languages.length === 0) return null;

  return (
    <div className="rounded-geist-md bg-geist-canvas dark:bg-neutral-900 geist-level-2 p-5">
      <h3 className="text-body-sm-strong text-geist-ink dark:text-white mb-3 flex items-center gap-2">
        <Code2 className="h-4 w-4 text-geist-mute dark:text-gray-400" />
        Trending languages
      </h3>
      <div className="flex flex-wrap gap-2">
        {languages.map((lang) => (
          <Badge key={lang} variant="outline" className="text-caption">
            {lang}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function ActiveMembersSection({
  members,
}: {
  members:
    | Array<{
        id: string;
        alias: string;
        avatar_url: string;
        github_username: string;
      }>
    | undefined;
}) {
  if (!members || members.length === 0) return null;

  return (
    <div className="rounded-geist-md bg-geist-canvas dark:bg-neutral-900 geist-level-2 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-body-sm-strong text-geist-ink dark:text-white flex items-center gap-2">
          <Users className="h-4 w-4 text-geist-mute dark:text-gray-400" />
          Community members
        </h3>
        <Link
          href="/members"
          className="text-caption text-geist-link hover:text-geist-link-deep transition-colors dark:text-primary-400 dark:hover:text-primary-300"
        >
          View all
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {members.slice(0, 12).map((member) => (
          <Link key={member.id} href={`/profiles/${member.alias}`} title={member.alias}>
            <Avatar
              src={member.avatar_url}
              alt={member.alias}
              fallback={member.alias.charAt(0).toUpperCase()}
              size="sm"
              className="h-8 w-8 ring-2 ring-geist-canvas dark:ring-black hover:ring-geist-hairline dark:hover:ring-neutral-700 transition-all"
            />
          </Link>
        ))}
        {members.length > 12 && (
          <Link
            href="/members"
            className="h-8 w-8 rounded-full bg-geist-canvas-soft-2 dark:bg-neutral-800 flex items-center justify-center text-caption text-geist-mute dark:text-gray-400 hover:bg-geist-canvas-soft dark:hover:bg-neutral-700 hover:text-geist-ink dark:hover:text-white transition-colors"
          >
            +{members.length - 12}
          </Link>
        )}
      </div>
    </div>
  );
}
