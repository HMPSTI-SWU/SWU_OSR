import { PublicProfile } from '@/features/profile/PublicProfile';

interface ProfilePageProps {
  params: { alias: string };
}

export default function ProfilePage({ params }: ProfilePageProps) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <PublicProfile alias={params.alias} />
    </div>
  );
}
