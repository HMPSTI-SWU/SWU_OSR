'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/components/AuthProvider';
import { LoginForm } from '@/features/auth/LoginForm';
import { Skeleton } from '@/components/ui/skeleton';
import { Code2, Shield, Github, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const { isReady, isAuthenticated } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (isReady && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isReady, isAuthenticated, router]);

  // While auth is rehydrating, show a minimal loading state
  if (!isReady) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-12 w-12 mx-auto rounded-geist-md" />
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-64 mx-auto" />
          <Skeleton className="h-48 w-full rounded-geist-md" />
        </div>
      </div>
    );
  }

  // If authenticated, don't render login form (redirect is happening)
  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Left side - branding */}
        <div className="hidden lg:block">
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center">
                <Code2 className="h-5 w-5 text-white" />
              </div>
              <span className="text-2xl font-bold text-gradient dark:text-white">ORBIT</span>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white leading-tight">
              Join the student
              <br />
              developer community
            </h2>
            <p className="text-gray-600 dark:text-white max-w-sm">
              Showcase your projects, track contributions, and collaborate with fellow students at
              STMIK Widya Utama.
            </p>

            <div className="space-y-4 pt-4">
              <Step
                icon={Shield}
                title="1. Login with SIAKAD"
                description="Verify your student identity securely"
              />
              <Step
                icon={Github}
                title="2. Link GitHub"
                description="Connect your GitHub account"
              />
              <Step
                icon={ArrowRight}
                title="3. Start Showcasing"
                description="Add repos and build your portfolio"
              />
            </div>
          </div>
        </div>

        {/* Right side - form */}
        <div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}

function Step({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-8 w-8 rounded-lg bg-primary-50 dark:bg-neutral-800 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-primary-600 dark:text-white" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">{title}</p>
        <p className="text-xs text-gray-500 dark:text-white">{description}</p>
      </div>
    </div>
  );
}
