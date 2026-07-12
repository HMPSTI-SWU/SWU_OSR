'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Repository, AcademicTag, ShowcaseSelection, ShowcaseRepo } from '@/types/showcase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { Globe, Plus, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu';

const ACADEMIC_TAGS: AcademicTag[] = [
  'coursework',
  'thesis',
  'hackathon',
  'personal_research',
  'team_project',
];

export function RepoSelector() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    data: repos,
    isLoading,
    isError,
    refetch,
  } = useQuery<Repository[]>({
    queryKey: ['availableRepos'],
    queryFn: async () => {
      const { data } = await api.get<{ ok: boolean; data: Repository[] }>('/repos/available');
      return data.data;
    },
  });

  const { data: showcaseRepos } = useQuery<ShowcaseRepo[]>({
    queryKey: ['showcaseRepos'],
    queryFn: async () => {
      const { data } = await api.get<{ ok: boolean; data: ShowcaseRepo[] }>('/showcase');
      return data.data;
    },
  });

  const showcasedFullNames = new Set((showcaseRepos ?? []).map((r) => r.repo_full_name));

  const saveShowcase = useMutation({
    mutationFn: async (items: ShowcaseSelection[]) => {
      const { data } = await api.post('/showcase', { selections: items });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['showcaseRepos'] });
      toast('Repository added to showcase!', 'success');
    },
    onError: () => {
      toast('Failed to add repository', 'error');
    },
  });

  const handleAdd = (repo: Repository, tag: AcademicTag) => {
    saveShowcase.mutate([
      {
        repo_id: repo.id,
        repo_name: repo.name,
        full_name: repo.full_name,
        tag,
      },
    ]);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-gray-600 dark:text-white mb-3">
            Failed to load available repositories.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!repos || repos.length === 0) {
    return (
      <p className="text-center text-gray-500 dark:text-white">
        No repositories found. Make sure your GitHub account is linked.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {repos.map((repo) => {
        const alreadyShowcased = showcasedFullNames.has(repo.full_name);
        return (
          <Card key={repo.id} className={alreadyShowcased ? 'opacity-60' : ''}>
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-gray-900 dark:text-white truncate">
                    {repo.name}
                  </h3>
                  <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded bg-green-50 dark:bg-neutral-800 text-green-700 dark:text-white border border-green-200 dark:border-neutral-700">
                    <Globe className="h-2.5 w-2.5" />
                    Public
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1 truncate">
                  {repo.description || 'No description provided.'}
                </p>
                {repo.language && (
                  <div className="mt-2">
                    <Badge variant="secondary">{repo.language}</Badge>
                  </div>
                )}
              </div>

              <div className="shrink-0 flex items-center">
                {alreadyShowcased ? (
                  <Badge className="bg-green-100 dark:bg-neutral-800 text-green-800 dark:text-white border-green-200 dark:border-neutral-700 py-1.5 px-3">
                    Already in Showcase
                  </Badge>
                ) : (
                  <DropdownMenu
                    align="right"
                    trigger={
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full sm:w-auto"
                        disabled={saveShowcase.isPending}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
                      </Button>
                    }
                  >
                    <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-geist-mute dark:text-neutral-500">
                      Select Category
                    </div>
                    {ACADEMIC_TAGS.map((tag) => (
                      <DropdownMenuItem
                        key={tag}
                        onClick={() => handleAdd(repo, tag)}
                        className="capitalize"
                      >
                        {tag.replace('_', ' ')}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenu>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
