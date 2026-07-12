'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthContext } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { PublicActivityFeed } from '@/features/feed/PublicActivityFeed';
import {
  Code2,
  FolderGit2,
  MessageSquare,
  Trophy,
  ArrowRight,
  Shield,
  Globe,
  Activity,
} from 'lucide-react';

/**
 * Marketing / landing page for unauthenticated visitors.
 * If the user is already authenticated, redirect to /dashboard.
 */
export default function WelcomePage() {
  const { isReady, isAuthenticated } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (isReady && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isReady, isAuthenticated, router]);

  // Don't render marketing content for authenticated users
  if (isAuthenticated) return null;

  return (
    <div>
      <HeroSection />
      <FeedPreviewSection />
      <FeaturesSection />
      <CTASection />
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-geist-canvas dark:bg-black">
      <div className="absolute inset-0 geist-mesh-gradient" />
      <div className="relative mx-auto max-w-geist-page px-6 py-24 sm:py-32 lg:py-40">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-geist-full bg-geist-canvas-soft border border-geist-hairline dark:bg-neutral-900 dark:border-neutral-800 mb-8 animate-fade-in">
            <span className="text-caption-mono text-geist-body dark:text-white">
              Open source platform for students
            </span>
          </div>
          <h1 className="text-display-xl text-geist-ink dark:text-white animate-slide-up">
            Showcase your code, build your future.
          </h1>
          <p className="mt-6 text-body-lg text-geist-body dark:text-white max-w-2xl mx-auto animate-slide-up">
            Platform mahasiswa STMIK Widya Utama untuk menampilkan proyek open source, berkolaborasi
            dengan peers, dan membangun portofolio profesional.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up">
            <Link href="/login">
              <Button variant="default" size="default">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/members">
              <Button variant="secondary" size="default">
                Browse Members
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeedPreviewSection() {
  return (
    <section className="py-16 bg-geist-canvas dark:bg-[#0A0A0A]">
      <div className="mx-auto max-w-geist-page px-6">
        <div className="text-center mb-8">
          <h2 className="text-display-lg text-geist-ink dark:text-white">Community Activity</h2>
          <p className="mt-3 text-body-md text-geist-body dark:text-gray-300 max-w-xl mx-auto">
            See what our members are building in real time.
          </p>
        </div>
        <div className="max-w-2xl mx-auto">
          <PublicActivityFeed />
        </div>
        <div className="text-center mt-8">
          <Link href="/feed">
            <Button variant="outline" size="default">
              View full feed
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    {
      icon: FolderGit2,
      title: 'Project showcase.',
      description: 'Tampilkan repository GitHub terbaik kamu dengan tag akademik.',
    },
    {
      icon: Activity,
      title: 'Activity tracking.',
      description: 'Webhook otomatis mencatat setiap push, PR, dan release.',
    },
    {
      icon: MessageSquare,
      title: 'Discussions.',
      description: 'Forum per-repository untuk review kode dan kolaborasi.',
    },
    {
      icon: Shield,
      title: 'Pseudonymous identity.',
      description: 'Gunakan alias publik. Identitas hanya terlihat sesama pengguna.',
    },
    {
      icon: Trophy,
      title: 'Badges & streaks.',
      description: 'Dapatkan badges berdasarkan pencapaian dan konsistensi.',
    },
    {
      icon: Globe,
      title: 'Public portfolio.',
      description: 'Profil publik yang bisa dibagikan ke recruiter atau siapa saja.',
    },
  ];

  return (
    <section className="py-24 bg-geist-canvas-soft dark:bg-[#0A0A0A]">
      <div className="mx-auto max-w-geist-page px-6">
        <div className="text-center mb-16">
          <p className="text-caption-mono text-geist-mute dark:text-white0 uppercase mb-4">
            Features
          </p>
          <h2 className="text-display-lg text-geist-ink dark:text-white">
            Everything you need to stand out.
          </h2>
          <p className="mt-4 text-body-lg text-geist-body dark:text-white max-w-xl mx-auto">
            Satu platform untuk semua kebutuhan portofolio open source mahasiswa.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="p-6 rounded-geist-md bg-geist-canvas dark:bg-neutral-900 geist-level-3 transition-shadow hover:shadow-geist-4"
              >
                <div className="h-10 w-10 rounded-geist-sm bg-geist-canvas-soft-2 dark:bg-neutral-800 flex items-center justify-center mb-4">
                  <Icon className="h-5 w-5 text-geist-ink dark:text-white" />
                </div>
                <h3 className="text-display-sm text-geist-ink dark:text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-body-sm text-geist-body dark:text-white">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="py-24 bg-geist-canvas-soft dark:bg-[#0A0A0A]">
      <div className="mx-auto max-w-geist-page px-6">
        <div className="rounded-geist-lg bg-geist-primary dark:bg-white p-12 sm:p-16 text-center">
          <h2 className="text-display-lg text-geist-on-primary dark:text-black mb-4">
            Ready to build your portfolio?
          </h2>
          <p className="text-body-lg text-geist-on-primary/70 dark:text-black/60 max-w-xl mx-auto mb-10">
            Mulai showcase karya open source kamu hari ini. Login dengan akun SIAKAD dan hubungkan
            GitHub.
          </p>
          <Link href="/login">
            <Button
              variant="secondary"
              size="default"
              className="dark:bg-black dark:text-white dark:hover:bg-neutral-900"
            >
              Start now — it&apos;s free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
