'use client';

import { RepoSelector } from '@/features/showcase/RepoSelector';
import { ShowcaseGrid } from '@/features/showcase/ShowcaseGrid';
import { FolderGit2, Plus } from 'lucide-react';

export default function ShowcasePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-primary-50 dark:bg-neutral-800 flex items-center justify-center">
            <FolderGit2 className="h-5 w-5 text-primary-600 dark:text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Manage Your Showcase
            </h1>
            <p className="text-sm text-gray-500 dark:text-white">
              Curate which repositories represent your best work.
            </p>
          </div>
        </div>
      </div>

      {/* Your Showcase */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-secondary-500" />
          Your Showcase Repositories
        </h2>
        <ShowcaseGrid />
      </section>

      {/* Add Repos */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary-600 dark:text-white" />
          Add Repositories
        </h2>
        <RepoSelector />
      </section>
    </div>
  );
}
