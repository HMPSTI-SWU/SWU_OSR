'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import type { ShowcaseRepo, AcademicTag } from '@/types/showcase';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import {
  ExternalLink,
  Trash2,
  Pencil,
  MessageSquare,
  FolderGit2,
  Webhook,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const ACADEMIC_TAGS: AcademicTag[] = [
  'coursework',
  'thesis',
  'hackathon',
  'personal_research',
  'team_project',
];

const PAGE_SIZE = 6;

export function ShowcaseGrid() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingDescId, setEditingDescId] = useState<string | null>(null);
  const [editDescValue, setEditDescValue] = useState('');
  const [page, setPage] = useState(0);

  const {
    data: repos,
    isLoading,
    isError,
    refetch,
  } = useQuery<ShowcaseRepo[]>({
    queryKey: ['showcaseRepos'],
    queryFn: async () => {
      const { data } = await api.get<{ ok: boolean; data: ShowcaseRepo[] }>('/showcase');
      return data.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/showcase/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['showcaseRepos'] });
      toast('Repository removed from showcase', 'success');
    },
    onError: () => {
      toast('Failed to remove repository', 'error');
    },
  });

  const updateTagMutation = useMutation({
    mutationFn: async ({ repo, newTag }: { repo: ShowcaseRepo; newTag: AcademicTag }) => {
      await api.delete(`/showcase/${repo.id}`);
      try {
        await api.post('/showcase', {
          selections: [
            {
              repo_id: repo.github_repo_id,
              repo_name: repo.repo_name,
              full_name: repo.repo_full_name,
              tag: newTag,
            },
          ],
        });
      } catch (postError) {
        try {
          await api.post('/showcase', {
            selections: [
              {
                repo_id: repo.github_repo_id,
                repo_name: repo.repo_name,
                full_name: repo.repo_full_name,
                tag: repo.academic_tag,
              },
            ],
          });
        } catch {
          // Rollback also failed
        }
        throw postError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['showcaseRepos'] });
      toast('Tag updated successfully', 'success');
      setEditingTagId(null);
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['showcaseRepos'] });
      toast('Failed to update tag', 'error');
      setEditingTagId(null);
    },
  });

  const handleRemove = (repo: ShowcaseRepo) => {
    if (window.confirm(`Remove "${repo.repo_name}" from your showcase?`)) {
      deleteMutation.mutate(repo.id);
    }
  };

  const updateDescMutation = useMutation({
    mutationFn: async ({ id, description }: { id: string; description: string }) => {
      await api.patch(`/showcase/${id}`, { description });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['showcaseRepos'] });
      toast('Description updated', 'success');
      setEditingDescId(null);
    },
    onError: () => {
      toast('Failed to update description', 'error');
    },
  });

  const handleStartEditDesc = (repo: ShowcaseRepo) => {
    setEditingDescId(repo.id);
    setEditDescValue(repo.description || '');
  };

  const handleSaveDesc = (repoId: string) => {
    updateDescMutation.mutate({ id: repoId, description: editDescValue });
  };

  const handleTagChange = (repo: ShowcaseRepo, newTag: AcademicTag) => {
    if (newTag !== repo.academic_tag) {
      updateTagMutation.mutate({ repo, newTag });
    } else {
      setEditingTagId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-geist-md" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="h-12 w-12 rounded-geist-full bg-geist-error-soft dark:bg-neutral-800 flex items-center justify-center mx-auto mb-3">
            <FolderGit2 className="h-5 w-5 text-geist-error dark:text-white" />
          </div>
          <p className="text-body-sm text-geist-body dark:text-white mb-4">
            Failed to load showcase repositories.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!repos || repos.length === 0) {
    return (
      <Card className="border border-dashed border-geist-hairline dark:border-neutral-700">
        <CardContent className="p-10 text-center">
          <div className="h-12 w-12 rounded-geist-full bg-geist-canvas-soft-2 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
            <FolderGit2 className="h-6 w-6 text-geist-mute dark:text-white" />
          </div>
          <h3 className="text-body-md-strong text-geist-ink dark:text-white mb-1">
            No repositories yet.
          </h3>
          <p className="text-body-sm text-geist-body dark:text-white max-w-sm mx-auto">
            Add your best GitHub repositories below to start building your showcase portfolio.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalPages = Math.ceil(repos.length / PAGE_SIZE);
  const paginatedRepos = repos.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {paginatedRepos.map((repo) => (
          <Card
            key={repo.id}
            className="group transition-shadow hover:shadow-geist-3 overflow-hidden"
          >
            {/* Top accent — ink-black bar / white bar in dark */}
            <div className="h-0.5 bg-geist-primary dark:bg-white" />
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <Link
                  href={`/repos/${repo.id}`}
                  className="text-body-sm-strong text-geist-link dark:text-white hover:text-geist-link-deep dark:hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <FolderGit2 className="h-4 w-4" />
                  {repo.repo_name}
                </Link>
                <button
                  onClick={() => handleRemove(repo)}
                  disabled={deleteMutation.isPending}
                  className="p-1.5 rounded-geist-sm text-geist-mute hover:text-geist-error hover:bg-geist-error-soft dark:text-white dark:hover:text-white dark:hover:bg-neutral-800 transition-all opacity-0 group-hover:opacity-100"
                  title="Remove from showcase"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="text-body-sm text-geist-body dark:text-white mb-3 line-clamp-2">
                {editingDescId === repo.id ? (
                  <span className="flex gap-1.5">
                    <input
                      type="text"
                      value={editDescValue}
                      onChange={(e) => setEditDescValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveDesc(repo.id);
                        if (e.key === 'Escape') setEditingDescId(null);
                      }}
                      className="flex-1 px-2 py-1 text-sm border border-geist-hairline dark:border-neutral-700 rounded-geist-sm bg-geist-canvas dark:bg-neutral-900 dark:text-white focus:outline-none focus:border-geist-hairline-strong dark:focus:border-neutral-600"
                      placeholder="Add a description..."
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveDesc(repo.id)}
                      className="px-2 py-1 text-xs rounded-geist-sm bg-geist-primary text-geist-on-primary hover:bg-geist-ink/90 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                      disabled={updateDescMutation.isPending}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingDescId(null)}
                      className="px-2 py-1 text-xs rounded-geist-sm border border-geist-hairline dark:border-neutral-700 text-geist-body dark:text-white hover:bg-geist-canvas-soft dark:hover:bg-neutral-800"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <span
                    onClick={() => handleStartEditDesc(repo)}
                    className="cursor-pointer hover:text-geist-ink dark:hover:text-white transition-colors"
                    title="Click to edit description"
                  >
                    {repo.description || 'Click to add description...'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap mb-3">
                {repo.language && (
                  <Badge variant="secondary" className="text-[10px]">
                    {repo.language}
                  </Badge>
                )}
                {editingTagId === repo.id ? (
                  <div className="flex flex-wrap gap-1">
                    {ACADEMIC_TAGS.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => handleTagChange(repo, tag)}
                        className={`px-2 py-0.5 text-[10px] rounded-geist-full border transition-all ${
                          tag === repo.academic_tag
                            ? 'bg-geist-primary text-geist-on-primary border-transparent dark:bg-white dark:text-black'
                            : 'bg-geist-canvas text-geist-body border-geist-hairline hover:border-geist-hairline-strong dark:bg-neutral-900 dark:text-white dark:border-neutral-700 dark:hover:border-neutral-600'
                        }`}
                        disabled={updateTagMutation.isPending}
                      >
                        {tag.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Badge variant="default" className="text-[10px]">
                      {repo.academic_tag.replace('_', ' ')}
                    </Badge>
                    <button
                      onClick={() => setEditingTagId(repo.id)}
                      className="p-0.5 rounded-geist-sm text-geist-mute dark:text-white hover:text-geist-ink dark:hover:text-white transition-colors"
                      title="Edit tag"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Footer actions */}
              <div className="flex items-center gap-3 pt-3 border-t border-geist-hairline dark:border-neutral-800">
                <Link
                  href={`/repos/${repo.id}/discussions`}
                  className="text-caption text-geist-mute dark:text-white hover:text-geist-ink dark:hover:text-white flex items-center gap-1 transition-colors"
                >
                  <MessageSquare className="h-3 w-3" />
                  Discussions
                </Link>
                <a
                  href={repo.html_url || `https://github.com/${repo.repo_full_name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-caption text-geist-mute dark:text-white hover:text-geist-ink dark:hover:text-white flex items-center gap-1 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  GitHub
                </a>
                <div className="flex items-center gap-1 text-caption text-geist-mute dark:text-white ml-auto">
                  <Webhook className="h-3 w-3" />
                  <span className="text-caption-mono">webhook active</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
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
