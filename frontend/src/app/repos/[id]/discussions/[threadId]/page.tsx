'use client';

import { ThreadDetail } from '@/features/forum/ThreadDetail';

interface ThreadPageProps {
  params: { id: string; threadId: string };
}

export default function ThreadPage({ params }: ThreadPageProps) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <ThreadDetail repoId={params.id} threadId={params.threadId} />
    </div>
  );
}
