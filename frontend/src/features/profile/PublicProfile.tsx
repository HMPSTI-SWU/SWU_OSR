'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { resolveUploadUrl, sanitizeUrl } from '@/lib/url';
import type { PublicProfile as PublicProfileType, AcademicIdentity, UserSkill } from '@/types/user';
import { useCurrentUser } from '@/hooks/useAuth';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogHeader, DialogTitle, DialogContent } from '@/components/ui/dialog';
import { SkillSection } from './SkillSection';
import {
  ExternalLink,
  MessageSquare,
  X,
  GitBranch,
  FolderGit2,
  Code2,
  Calendar,
  Flame,
  Eye,
} from 'lucide-react';
import { ContributionHeatmap } from './ContributionHeatmap';
import { BadgeDisplay } from './BadgeDisplay';

interface PublicProfileProps {
  alias: string;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function PublicProfile({ alias }: PublicProfileProps) {
  const { data: currentUser } = useCurrentUser();
  const [identityOpen, setIdentityOpen] = useState(false);
  const [identity, setIdentity] = useState<AcademicIdentity | null>(null);
  const [identityLoading, setIdentityLoading] = useState(false);

  const {
    data: profile,
    isLoading,
    isError,
  } = useQuery<PublicProfileType>({
    queryKey: ['profile', alias],
    queryFn: async () => {
      const { data } = await api.get<{ ok: boolean; data: PublicProfileType }>(
        `/profiles/${alias}`
      );
      return data.data;
    },
  });

  // Fetch skills for this profile
  const { data: skills, refetch: refetchSkills } = useQuery<UserSkill[]>({
    queryKey: ['skills', profile?.id],
    queryFn: async () => {
      const { data } = await api.get<{ ok: boolean; data: UserSkill[] }>(
        `/users/${profile!.id}/skills`
      );
      return data.data ?? [];
    },
    enabled: !!profile?.id,
  });

  const isOwnProfile = !!currentUser && currentUser.alias === alias;

  const handleViewIdentity = async () => {
    setIdentityLoading(true);
    try {
      const { data } = await api.get<{ ok: boolean; data: AcademicIdentity }>(
        `/profiles/${alias}/identity`
      );
      setIdentity(data.data);
      setIdentityOpen(true);
    } catch {
      setIdentity(null);
      setIdentityOpen(true);
    } finally {
      setIdentityLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <Card className="border-gray-100 dark:border-neutral-800">
        <CardContent className="p-12 text-center">
          <div className="h-16 w-16 rounded-full bg-gray-50 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
            <Code2 className="h-8 w-8 text-gray-300" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
            Profile not found
          </h3>
          <p className="text-sm text-gray-500 dark:text-white">
            This user doesn&apos;t exist or has been removed.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Profile Header */}
      <Card>
        {/* Profile banner — shows custom upload or default gradient */}
        <div className="h-32 sm:h-40 relative rounded-t-lg overflow-hidden">
          {profile.banner_url ? (
            // Custom banner (image or video)
            profile.banner_url.endsWith('.mp4') || profile.banner_url.endsWith('.webm') ? (
              <video
                src={sanitizeUrl(resolveUploadUrl(profile.banner_url))}
                className="w-full h-full object-cover"
                autoPlay
                loop
                muted
                playsInline
              />
            ) : (
              <img
                src={sanitizeUrl(resolveUploadUrl(profile.banner_url))}
                alt={`${profile.alias}'s banner`}
                className="w-full h-full object-cover"
              />
            )
          ) : (
            // Default gradient banner
            <>
              <div className="w-full h-full gradient-primary" />
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoLTJ2LTZoMnptMC0xMHY2aC0ydi02aDJ6bTAtMTB2NmgtMlY0aDJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
            </>
          )}
        </div>
        <CardContent className="px-6 pb-6 -mt-12">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <Avatar
              src={profile.avatar_url}
              alt={profile.alias}
              fallback={profile.alias.charAt(0).toUpperCase()}
              size="lg"
              className="ring-4 ring-white shadow-lg shrink-0"
            />
            <div className="flex-1 min-w-0 pt-2 sm:pt-14">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white break-words">
                    {profile.alias}
                  </h1>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge
                      className={`${
                        profile.role === 'faculty'
                          ? 'bg-orange-50 text-orange-700 border-orange-200'
                          : 'bg-primary-50 text-primary-700 dark:bg-neutral-800 dark:text-white border-primary-200'
                      }`}
                    >
                      {profile.role}
                    </Badge>
                    {profile.github_username && (
                      <a
                        href={`https://github.com/${profile.github_username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-gray-500 dark:text-white hover:text-primary-600 dark:hover:text-white flex items-center gap-1 transition-colors"
                      >
                        @{profile.github_username}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    <span className="text-xs text-gray-400 dark:text-white flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Joined {formatDate(profile.created_at)}
                    </span>
                  </div>
                </div>
                {currentUser && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleViewIdentity}
                    disabled={identityLoading}
                    className="flex items-center gap-1.5"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {identityLoading ? 'Loading...' : 'View Identity'}
                  </Button>
                )}
              </div>
              {profile.bio && (
                <p className="text-gray-600 dark:text-white mt-3 max-w-lg">{profile.bio}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Row */}
      {profile.stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatItem
            icon={GitBranch}
            value={profile.stats.total_commits}
            label="Commits"
            color="text-green-600 bg-green-50"
          />
          <StatItem
            icon={FolderGit2}
            value={profile.stats.total_repos}
            label="Repos"
            color="text-blue-600 dark:text-white bg-blue-50"
          />
          <StatItem
            icon={Code2}
            value={profile.stats.languages.length}
            label="Languages"
            color="text-purple-600 bg-purple-50"
          />
          <StatItem
            icon={Calendar}
            value={profile.stats.active_days}
            label="Active Days"
            color="text-orange-600 bg-orange-50"
          />
          <StatItem
            icon={Flame}
            value={profile.stats.current_streak}
            label="Day Streak"
            color="text-red-600 bg-red-50"
          />
        </div>
      )}

      {/* Contribution Heatmap */}
      {profile.stats && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-secondary-600 dark:text-white" />
              Contribution Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ContributionHeatmap contributionDays={profile.stats.contribution_days} />
          </CardContent>
        </Card>
      )}

      {/* Badges */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">🏆 Badges</CardTitle>
        </CardHeader>
        <CardContent>
          <BadgeDisplay stats={profile.stats} />
        </CardContent>
      </Card>

      {/* Languages */}
      {profile.stats && profile.stats.languages.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Code2 className="h-4 w-4 text-purple-600" />
              Languages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {profile.stats.languages.map((lang) => (
                <span
                  key={lang}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-50 dark:bg-neutral-800 text-gray-700 dark:text-white border border-gray-100 dark:border-neutral-800 hover:border-primary-200 hover:bg-primary-50 transition-colors"
                >
                  {lang}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Skills */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            ⚡ Skills
            {isOwnProfile && (
              <a
                href="/settings#skills"
                className="ml-auto text-[11px] font-normal text-geist-mute dark:text-neutral-500 hover:text-geist-ink dark:hover:text-white transition-colors"
              >
                Manage →
              </a>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SkillSection
            userID={profile.id}
            skills={skills ?? []}
            isOwn={isOwnProfile}
            onRefetch={() => refetchSkills()}
          />
        </CardContent>
      </Card>

      {/* Showcase Repos */}
      {profile.showcase_repos && profile.showcase_repos.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <FolderGit2 className="h-5 w-5 text-primary-600 dark:text-white" />
            Showcase Repositories
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {profile.showcase_repos.map((repo) => (
              <Card
                key={repo.id}
                className="hover:border-primary-200 hover:shadow-sm transition-all"
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <a
                      href={repo.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary-600 dark:text-white hover:underline flex items-center gap-1"
                    >
                      {repo.repo_name}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <Badge
                      variant="secondary"
                      className="text-[10px] bg-secondary-50 text-secondary-700 dark:bg-neutral-800 dark:text-white"
                    >
                      {repo.academic_tag.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-white mb-3 line-clamp-2">
                    {repo.description || 'No description'}
                  </p>
                  <div className="flex items-center gap-3">
                    {repo.language && (
                      <Badge variant="secondary" className="text-[10px]">
                        {repo.language}
                      </Badge>
                    )}
                    <Link
                      href={`/repos/${repo.id}/discussions`}
                      className="text-xs text-gray-400 dark:text-white hover:text-primary-600 dark:hover:text-white flex items-center gap-1 ml-auto transition-colors"
                    >
                      <MessageSquare className="h-3 w-3" />
                      Discussions
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Identity Dialog */}
      <Dialog open={identityOpen} onOpenChange={setIdentityOpen}>
        <button
          onClick={() => setIdentityOpen(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
        <DialogHeader>
          <DialogTitle>Academic Identity</DialogTitle>
        </DialogHeader>
        <DialogContent>
          {identity ? (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-neutral-800 space-y-2">
                <InfoRow label="Full Name" value={identity.full_name} />
                <InfoRow label="NIM" value={identity.nim} />
                <InfoRow label="Major" value={identity.major} />
                <InfoRow label="Semester" value={String(identity.semester)} />
              </div>
              <p className="text-xs text-gray-400 dark:text-white text-center">
                This information is only visible to registered users.
              </p>
            </div>
          ) : (
            <p className="text-gray-500 dark:text-white text-center py-4">
              Unable to load identity information.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatItem({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
  color: string;
}) {
  const [iconColor, bgColor] = color.split(' ');
  return (
    <Card className="hover-lift">
      <CardContent className="p-4 text-center">
        <div className={`inline-flex p-2 rounded-lg ${bgColor} mb-2`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        <p className="text-xs text-gray-500 dark:text-white">{label}</p>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500 dark:text-white">{label}</span>
      <span className="text-sm font-medium text-gray-900 dark:text-white">{value}</span>
    </div>
  );
}
