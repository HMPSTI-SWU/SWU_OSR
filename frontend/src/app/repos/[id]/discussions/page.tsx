'use client';

import Link from 'next/link';
import { ThreadList } from '@/features/forum/ThreadList';
import { CreateThreadForm } from '@/features/forum/CreateThreadForm';
import { MessageSquare, ArrowLeft } from 'lucide-react';

interface DiscussionsPageProps {
  params: { id: string };
}

export default function DiscussionsPage({ params }: DiscussionsPageProps) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/repos/${params.id}`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-white hover:text-primary-600 dark:hover:text-white mb-3 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Showcase
        </Link>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center">
            <MessageSquare className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Discussions</h1>
            <p className="text-sm text-gray-500 dark:text-white">
              Ask questions, share feedback, and collaborate.
            </p>
          </div>
        </div>
      </div>

      {/* Create thread form */}
      <CreateThreadForm repoId={params.id} />

      {/* Thread list */}
      <div className="mt-8">
        <ThreadList repoId={params.id} />
      </div>
    </div>
  );
}
