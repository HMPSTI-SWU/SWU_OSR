'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import type { PublicProfile } from '@/types/user';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Search, GitBranch, FolderGit2, ExternalLink, UserCircle } from 'lucide-react';

interface MembersResponse {
  members: PublicProfile[];
  total: number;
}

export default function MembersPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'faculty'>('all');

  const { data, isLoading, isError, refetch } = useQuery<MembersResponse>({
    queryKey: ['members'],
    queryFn: async () => {
      const { data } = await api.get<{
        ok: boolean;
        data: MembersResponse;
      }>('/members');
      return data.data;
    },
    retry: 1,
  });

  const members = data?.members ?? [];

  // Client-side filtering
  const filtered = members.filter((m) => {
    const matchesSearch =
      search === '' ||
      m.alias.toLowerCase().includes(search.toLowerCase()) ||
      (m.bio && m.bio.toLowerCase().includes(search.toLowerCase())) ||
      (m.github_username && m.github_username.toLowerCase().includes(search.toLowerCase()));
    const matchesRole = roleFilter === 'all' || m.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-purple-50 dark:bg-neutral-800 flex items-center justify-center">
            <Users className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Discover Members</h1>
            <p className="text-sm text-gray-500 dark:text-white">
              {data?.total ?? 0} developers in the community
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-white" />
          <Input
            placeholder="Search by alias, bio, or GitHub username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'student', 'faculty'] as const).map((role) => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
                roleFilter === role
                  ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                  : 'bg-white dark:bg-neutral-900 text-gray-600 dark:text-white border-gray-200 dark:border-neutral-800 hover:border-primary-300 hover:bg-primary-50 dark:hover:bg-neutral-800'
              }`}
            >
              {role === 'all' ? 'All' : role.charAt(0).toUpperCase() + role.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <Card className="border-red-100">
          <CardContent className="p-8 text-center">
            <div className="h-12 w-12 rounded-full bg-red-50 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-3">
              <Users className="h-6 w-6 text-red-500" />
            </div>
            <p className="text-gray-600 dark:text-white mb-3">Failed to load members.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!isLoading && !isError && filtered.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="h-16 w-16 rounded-full bg-gray-50 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
              <UserCircle className="h-8 w-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
              {search ? 'No members found' : 'No members yet'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-white max-w-sm mx-auto">
              {search
                ? `No results for "${search}". Try a different search term.`
                : 'Be the first to join! Sign in with your SIAKAD credentials.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Members grid */}
      {!isLoading && !isError && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((member) => (
            <MemberCard key={member.id} member={member} />
          ))}
        </div>
      )}
    </div>
  );
}

function MemberCard({ member }: { member: PublicProfile }) {
  return (
    <Link href={`/profiles/${member.alias}`}>
      <Card className="h-full hover:border-primary-200 hover:shadow-md transition-all duration-200 cursor-pointer group">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <Avatar
              src={member.avatar_url}
              alt={member.alias}
              fallback={member.alias.charAt(0).toUpperCase()}
              size="md"
              className="ring-2 ring-gray-100 group-hover:ring-primary-100 transition-all"
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 dark:text-white truncate group-hover:text-primary-700 dark:hover:text-white transition-colors">
                {member.alias}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge
                  variant="secondary"
                  className={`text-[10px] ${
                    member.role === 'faculty'
                      ? 'bg-orange-50 text-orange-700'
                      : 'bg-primary-50 text-primary-700 dark:bg-neutral-800 dark:text-white'
                  }`}
                >
                  {member.role}
                </Badge>
                {member.github_username && (
                  <span className="text-xs text-gray-400 dark:text-white truncate">
                    @{member.github_username}
                  </span>
                )}
              </div>
            </div>
          </div>

          {member.bio && (
            <p className="text-sm text-gray-500 dark:text-white mt-3 line-clamp-2">{member.bio}</p>
          )}

          {/* Stats */}
          {member.stats && (
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-50">
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-white">
                <FolderGit2 className="h-3 w-3" />
                <span>{member.stats.total_repos} repos</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-white">
                <GitBranch className="h-3 w-3" />
                <span>{member.stats.total_commits} commits</span>
              </div>
            </div>
          )}

          {/* Languages */}
          {member.stats && member.stats.languages.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {member.stats.languages.slice(0, 4).map((lang) => (
                <span
                  key={lang}
                  className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-gray-50 dark:bg-neutral-800 text-gray-600 dark:text-white border border-gray-100 dark:border-neutral-800"
                >
                  {lang}
                </span>
              ))}
              {member.stats.languages.length > 4 && (
                <span className="px-2 py-0.5 text-[10px] text-gray-400 dark:text-white">
                  +{member.stats.languages.length - 4}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
