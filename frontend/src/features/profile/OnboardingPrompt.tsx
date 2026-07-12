'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCurrentUser } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { X, Sparkles } from 'lucide-react';

const DISMISS_KEY = 'swu_osr_onboarding_dismissed';

export function OnboardingPrompt() {
  const { data: user } = useCurrentUser();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === 'true');
  }, []);

  if (!user) return null;
  if (dismissed) return null;
  if (user.alias !== user.github_username && user.bio !== '') return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, 'true');
    setDismissed(true);
  };

  return (
    <div className="rounded-2xl border border-secondary-200 bg-gradient-to-r from-secondary-50 to-primary-50 p-5 mb-6 relative animate-scale-in">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1 rounded-lg text-gray-400 dark:text-white hover:text-gray-600 dark:text-white hover:bg-white/50 transition-all"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-white/80 flex items-center justify-center shrink-0">
          <Sparkles className="h-4 w-4 text-secondary-600 dark:text-white" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-0.5">
            Complete your profile
          </h3>
          <p className="text-sm text-gray-600 dark:text-white">
            Set a unique alias and bio to stand out in the community.
          </p>
          <Link href="/settings" className="inline-block mt-3">
            <Button size="sm" className="gradient-primary text-white border-0 shadow-sm">
              Set up your profile
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
