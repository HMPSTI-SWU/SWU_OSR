"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

const DISMISS_KEY = "swu_osr_onboarding_dismissed";

export function OnboardingPrompt() {
  const { data: user } = useCurrentUser();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "true");
  }, []);

  if (!user) return null;
  if (dismissed) return null;
  if (user.alias !== user.github_username && user.bio !== "") return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
  };

  return (
    <div className="border-l-4 border-l-millennium-cyan border border-millennium-border bg-white p-6 mb-8 relative">
      <button
        onClick={handleDismiss}
        className="absolute top-4 right-4 p-1 text-millennium-slate-mid hover:text-millennium-black transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
      <div>
        <h3 className="text-sm font-extrabold text-millennium-black uppercase tracking-wider mb-1">
          Complete your profile
        </h3>
        <p className="text-sm text-millennium-slate">
          Set a unique alias and bio to stand out in the community.
        </p>
        <Link href="/settings" className="inline-block mt-4">
          <Button size="sm">
            Set up your profile
          </Button>
        </Link>
      </div>
    </div>
  );
}
