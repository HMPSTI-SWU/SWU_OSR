'use client';

import { cn } from '@/lib/utils';
import type { LeaderboardPeriod } from '@/types/leaderboard';
import { Calendar, Infinity } from 'lucide-react';

interface PeriodToggleProps {
  period: LeaderboardPeriod;
  onChange: (period: LeaderboardPeriod) => void;
}

const periods: {
  value: LeaderboardPeriod;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: 'quarterly', label: 'This Quarter', icon: Calendar },
  { value: 'all_time', label: 'All Time', icon: Infinity },
];

export function PeriodToggle({ period, onChange }: PeriodToggleProps) {
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-geist-md bg-geist-canvas-soft dark:bg-neutral-900 border border-geist-hairline dark:border-neutral-800">
      {periods.map((p) => {
        const Icon = p.icon;
        return (
          <button
            key={p.value}
            onClick={() => onChange(p.value)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-geist-sm text-caption font-medium transition-all',
              period === p.value
                ? 'bg-geist-canvas dark:bg-neutral-800 text-geist-ink dark:text-white shadow-geist-1'
                : 'text-geist-mute dark:text-neutral-500 hover:text-geist-body dark:hover:text-neutral-300'
            )}
          >
            <Icon className="h-3 w-3" />
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
