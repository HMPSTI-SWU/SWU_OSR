'use client';

import type { UserStats } from '@/types/user';
import {
  GitBranch,
  Flame,
  MessageSquare,
  FolderGit2,
  Moon,
  Sun,
  Calendar,
  Lock,
  Sparkles,
  HelpCircle,
} from 'lucide-react';

// ─── Tier System ──────────────────────────────────────────────────────────────

type Tier = 'iron' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

const TIER_META: Record<
  Tier,
  {
    label: string;
    textClass: string;
    bgClass: string;
    borderClass: string;
    glowClass: string;
    badgeStyle: string;
  }
> = {
  iron: {
    label: 'Iron',
    textClass: 'text-zinc-500 dark:text-zinc-400',
    bgClass: 'bg-zinc-100 dark:bg-zinc-800/60',
    borderClass: 'border-zinc-300 dark:border-zinc-600',
    glowClass: '',
    badgeStyle: 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300',
  },
  bronze: {
    label: 'Bronze',
    textClass: 'text-amber-700 dark:text-amber-500',
    bgClass: 'bg-amber-50 dark:bg-amber-950/40',
    borderClass: 'border-amber-300 dark:border-amber-700',
    glowClass: '',
    badgeStyle: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400',
  },
  silver: {
    label: 'Silver',
    textClass: 'text-slate-600 dark:text-slate-300',
    bgClass: 'bg-slate-50 dark:bg-slate-800/40',
    borderClass: 'border-slate-300 dark:border-slate-500',
    glowClass: '',
    badgeStyle: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
  },
  gold: {
    label: 'Gold',
    textClass: 'text-yellow-600 dark:text-yellow-400',
    bgClass: 'bg-yellow-50 dark:bg-yellow-950/30',
    borderClass: 'border-yellow-400 dark:border-yellow-600',
    glowClass: 'shadow-[0_0_10px_rgba(234,179,8,0.2)] dark:shadow-[0_0_10px_rgba(234,179,8,0.15)]',
    badgeStyle: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-400',
  },
  platinum: {
    label: 'Platinum',
    textClass: 'text-cyan-600 dark:text-cyan-300',
    bgClass: 'bg-cyan-50 dark:bg-cyan-950/30',
    borderClass: 'border-cyan-400 dark:border-cyan-600',
    glowClass:
      'shadow-[0_0_14px_rgba(34,211,238,0.25)] dark:shadow-[0_0_14px_rgba(34,211,238,0.2)]',
    badgeStyle: 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300',
  },
  diamond: {
    label: 'Diamond',
    textClass:
      'text-transparent bg-clip-text bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500',
    bgClass:
      'bg-gradient-to-br from-violet-50 via-fuchsia-50 to-pink-50 dark:from-violet-950/30 dark:via-fuchsia-950/30 dark:to-pink-950/30',
    borderClass: 'border-fuchsia-400 dark:border-fuchsia-600',
    glowClass: 'shadow-[0_0_18px_rgba(217,70,239,0.3)] dark:shadow-[0_0_18px_rgba(217,70,239,0.2)]',
    badgeStyle:
      'bg-gradient-to-r from-violet-100 to-pink-100 dark:from-violet-900/50 dark:to-pink-900/50 text-fuchsia-700 dark:text-fuchsia-300',
  },
};

// ─── Badge Category Config ────────────────────────────────────────────────────

interface TierLevel {
  tier: Tier;
  threshold: number;
  label: string; // badge name at this tier
}

interface BadgeCategoryConfig {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  unit: string; // for progress display
  tiers: TierLevel[];
  getValue: (stats: UserStats) => number;
}

const BADGE_CATEGORIES: BadgeCategoryConfig[] = [
  // ── Commit & Code ──
  {
    id: 'code',
    icon: GitBranch,
    description: 'Commit contributions across all repositories',
    unit: 'commits',
    tiers: [
      { tier: 'iron', threshold: 1, label: 'Code Initiate' },
      { tier: 'bronze', threshold: 25, label: 'Code Apprentice' },
      { tier: 'silver', threshold: 100, label: 'Code Journeyman' },
      { tier: 'gold', threshold: 500, label: 'Code Master' },
      { tier: 'platinum', threshold: 1000, label: 'Code Virtuoso' },
      { tier: 'diamond', threshold: 5000, label: 'Code Deity' },
    ],
    getValue: (stats) => stats.total_commits,
  },
  // ── Streak ──
  {
    id: 'streak',
    icon: Flame,
    description: 'Consecutive days of contribution',
    unit: 'days streak',
    tiers: [
      { tier: 'iron', threshold: 3, label: 'Warm Up' },
      { tier: 'bronze', threshold: 7, label: 'On Fire' },
      { tier: 'silver', threshold: 14, label: 'Hot Streak' },
      { tier: 'gold', threshold: 30, label: 'Blazing' },
      { tier: 'platinum', threshold: 60, label: 'Inferno' },
      { tier: 'diamond', threshold: 100, label: 'Eternal Flame' },
    ],
    getValue: (stats) => stats.current_streak,
  },
  // ── Community (Forum) ──
  {
    id: 'community',
    icon: MessageSquare,
    description: 'Forum threads + comments posted',
    unit: 'forum posts',
    tiers: [
      { tier: 'iron', threshold: 5, label: 'Voice' },
      { tier: 'bronze', threshold: 20, label: 'Contributor' },
      { tier: 'silver', threshold: 75, label: 'Communicator' },
      { tier: 'gold', threshold: 200, label: 'Community Pillar' },
      { tier: 'platinum', threshold: 500, label: 'Community Legend' },
    ],
    getValue: (stats) => stats.forum_total ?? 0,
  },
  // ── Showcase ──
  {
    id: 'showcase',
    icon: FolderGit2,
    description: 'Projects in your showcase portfolio',
    unit: 'repos',
    tiers: [
      { tier: 'iron', threshold: 1, label: 'Portfolio Start' },
      { tier: 'bronze', threshold: 3, label: 'Builder' },
      { tier: 'silver', threshold: 7, label: 'Architect' },
      { tier: 'gold', threshold: 15, label: 'Visionary' },
    ],
    getValue: (stats) => stats.total_showcase_repos ?? stats.total_repos,
  },
];

// ─── Behavioral / Special Badges ─────────────────────────────────────────────

interface SpecialBadgeConfig {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  glowClass: string;
  isSecret?: boolean;
  check: (stats: UserStats) => boolean;
}

const SPECIAL_BADGES: SpecialBadgeConfig[] = [
  {
    id: 'night-owl',
    label: '🦉 Night Owl',
    description: 'Made 10+ contributions between midnight and 4am',
    icon: Moon,
    colorClass: 'text-indigo-600 dark:text-indigo-300',
    bgClass: 'bg-indigo-50 dark:bg-indigo-950/40',
    borderClass: 'border-indigo-300 dark:border-indigo-700',
    glowClass: '',
    check: (stats) => (stats.night_owl_count ?? 0) >= 10,
  },
  {
    id: 'early-bird',
    label: '☕ Early Bird',
    description: 'Made 10+ contributions before 7am',
    icon: Sun,
    colorClass: 'text-orange-500 dark:text-orange-300',
    bgClass: 'bg-orange-50 dark:bg-orange-950/40',
    borderClass: 'border-orange-300 dark:border-orange-700',
    glowClass: '',
    check: (stats) => (stats.early_bird_count ?? 0) >= 10,
  },
  {
    id: 'weekend-warrior',
    label: '📅 Weekend Warrior',
    description: 'Over 60% of contributions made on weekends',
    icon: Calendar,
    colorClass: 'text-teal-600 dark:text-teal-300',
    bgClass: 'bg-teal-50 dark:bg-teal-950/40',
    borderClass: 'border-teal-300 dark:border-teal-700',
    glowClass: '',
    check: (stats) => {
      const total = stats.total_push_count ?? 0;
      const weekend = stats.weekend_count ?? 0;
      return total >= 20 && weekend / total >= 0.6;
    },
  },
  {
    id: 'necromancer',
    label: '???',
    description: 'A hidden achievement. Keep contributing to discover it.',
    icon: HelpCircle,
    colorClass: 'text-rose-600 dark:text-rose-400',
    bgClass: 'bg-rose-50 dark:bg-rose-950/30',
    borderClass: 'border-rose-300 dark:border-rose-700',
    glowClass: 'shadow-[0_0_12px_rgba(244,63,94,0.2)]',
    isSecret: true,
    check: (stats) => (stats.forum_total ?? 0) >= 100 && stats.active_days >= 90,
  },
];

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Returns the highest earned tier and the next tier for a category.
 * Returns null earned tier if no tier is unlocked.
 */
function resolveEarnedTier(
  tiers: TierLevel[],
  value: number
): { earned: TierLevel | null; next: TierLevel | null } {
  let earned: TierLevel | null = null;
  let next: TierLevel | null = null;

  for (const tier of tiers) {
    if (value >= tier.threshold) {
      earned = tier;
    } else if (!next) {
      next = tier;
    }
  }

  return { earned, next };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TierBadgePill({ tier }: { tier: Tier }) {
  const meta = TIER_META[tier];
  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${meta.badgeStyle}`}
    >
      {meta.label}
    </span>
  );
}

function DiamondShimmer() {
  return (
    <span className="pointer-events-none absolute inset-0 rounded-xl overflow-hidden">
      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_2.5s_infinite] dark:via-white/5" />
    </span>
  );
}

interface CategoryCardProps {
  category: BadgeCategoryConfig;
  value: number;
}

function CategoryCard({ category, value }: CategoryCardProps) {
  const { earned, next } = resolveEarnedTier(category.tiers, value);
  const Icon = category.icon;
  const isLocked = !earned;

  if (isLocked && !next) return null;

  const activeTier = earned ? earned.tier : null;
  const meta = activeTier ? TIER_META[activeTier] : null;

  // Progress toward next tier
  const prevThreshold = earned ? earned.threshold : 0;
  const nextThreshold = next ? next.threshold : (earned?.threshold ?? 1);
  const progress = next
    ? Math.min(100, ((value - prevThreshold) / (nextThreshold - prevThreshold)) * 100)
    : 100;

  return (
    <div
      className={`relative overflow-hidden flex flex-col gap-2 p-3 rounded-xl border transition-all ${
        isLocked
          ? 'bg-geist-canvas-soft dark:bg-neutral-900 border-geist-hairline dark:border-neutral-800 opacity-60'
          : `${meta!.bgClass} ${meta!.borderClass} ${meta!.glowClass} hover:scale-[1.02]`
      }`}
    >
      {activeTier === 'diamond' && <DiamondShimmer />}

      {/* Icon + lock */}
      <div className="flex items-start justify-between">
        <div
          className={`h-8 w-8 rounded-lg flex items-center justify-center ${
            isLocked ? 'bg-geist-canvas-soft-2 dark:bg-neutral-800' : meta!.bgClass
          }`}
        >
          {isLocked ? (
            <Lock className="h-4 w-4 text-geist-mute dark:text-neutral-500" />
          ) : (
            <Icon className={`h-4 w-4 ${meta!.textClass}`} />
          )}
        </div>
        {earned && <TierBadgePill tier={earned.tier} />}
      </div>

      {/* Name */}
      <div>
        <p
          className={`text-xs font-semibold leading-tight ${
            isLocked ? 'text-geist-mute dark:text-neutral-500' : meta!.textClass
          }`}
        >
          {isLocked ? next?.label : earned?.label}
        </p>
        <p className="text-[10px] text-geist-mute dark:text-neutral-500 mt-0.5 leading-tight">
          {isLocked
            ? `${value} / ${next?.threshold} ${category.unit}`
            : `${value} ${category.unit}`}
        </p>
      </div>

      {/* Progress bar toward next tier */}
      {next && (
        <div className="space-y-0.5">
          <div className="h-1 rounded-full bg-geist-canvas-soft-2 dark:bg-neutral-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isLocked
                  ? 'bg-geist-hairline dark:bg-neutral-700'
                  : activeTier === 'diamond'
                    ? 'bg-gradient-to-r from-violet-500 to-pink-500'
                    : activeTier === 'platinum'
                      ? 'bg-cyan-500'
                      : activeTier === 'gold'
                        ? 'bg-yellow-500'
                        : activeTier === 'silver'
                          ? 'bg-slate-400'
                          : activeTier === 'bronze'
                            ? 'bg-amber-500'
                            : 'bg-zinc-400'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[9px] text-geist-mute dark:text-neutral-600">
            Next: {next.label} ({next.tier}) at {next.threshold}
          </p>
        </div>
      )}

      {!next && earned && (
        <p className="text-[9px] text-geist-mute dark:text-neutral-500 flex items-center gap-1">
          <Sparkles className="h-2.5 w-2.5" /> Max tier reached!
        </p>
      )}
    </div>
  );
}

interface SpecialBadgeCardProps {
  badge: SpecialBadgeConfig;
  earned: boolean;
}

function SpecialBadgeCard({ badge, earned }: SpecialBadgeCardProps) {
  const Icon = badge.icon;

  if (!earned && badge.isSecret) {
    // Show secret badge as a mysterious locked card
    return (
      <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-dashed border-geist-hairline dark:border-neutral-700 bg-geist-canvas-soft dark:bg-neutral-900 opacity-70">
        <div className="h-7 w-7 rounded-lg bg-geist-canvas-soft-2 dark:bg-neutral-800 flex items-center justify-center shrink-0">
          <HelpCircle className="h-3.5 w-3.5 text-geist-mute dark:text-neutral-600" />
        </div>
        <div>
          <p className="text-xs font-semibold text-geist-mute dark:text-neutral-500">
            ??? Secret Badge
          </p>
          <p className="text-[10px] text-geist-mute dark:text-neutral-600 leading-tight">
            Keep contributing to discover it...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${
        earned
          ? `${badge.bgClass} ${badge.borderClass} ${badge.glowClass} hover:scale-[1.02]`
          : 'border-geist-hairline dark:border-neutral-800 bg-geist-canvas-soft dark:bg-neutral-900 opacity-50'
      }`}
    >
      <div
        className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
          earned ? badge.bgClass : 'bg-geist-canvas-soft-2 dark:bg-neutral-800'
        }`}
      >
        {earned ? (
          <Icon className={`h-3.5 w-3.5 ${badge.colorClass}`} />
        ) : (
          <Lock className="h-3.5 w-3.5 text-geist-mute dark:text-neutral-600" />
        )}
      </div>
      <div className="min-w-0">
        <p
          className={`text-xs font-semibold leading-tight ${
            earned ? badge.colorClass : 'text-geist-mute dark:text-neutral-500'
          }`}
        >
          {badge.label}
        </p>
        <p className="text-[10px] text-geist-mute dark:text-neutral-500 leading-tight mt-0.5 truncate">
          {badge.description}
        </p>
      </div>
      {earned && (
        <span className="ml-auto shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-geist-canvas dark:bg-neutral-800 text-geist-body dark:text-neutral-400 uppercase tracking-wide">
          Special
        </span>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface BadgeDisplayProps {
  stats: UserStats | null;
}

export function BadgeDisplay({ stats }: BadgeDisplayProps) {
  if (!stats) {
    return (
      <div className="text-center py-6">
        <div className="h-12 w-12 rounded-full bg-gray-50 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-2">
          <Sparkles className="h-6 w-6 text-gray-300 dark:text-gray-500" />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Start contributing to earn badges!
        </p>
      </div>
    );
  }

  const earnedSpecial = SPECIAL_BADGES.filter((b) => b.check(stats));
  const totalEarnedCount =
    BADGE_CATEGORIES.filter((cat) => cat.getValue(stats) >= cat.tiers[0].threshold).length +
    earnedSpecial.length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-geist-mute dark:text-neutral-500 uppercase tracking-wide font-medium">
          Badges & Achievements
        </p>
        {totalEarnedCount > 0 && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            {totalEarnedCount} earned
          </span>
        )}
      </div>

      {/* Tier categories grid */}
      <div className="grid grid-cols-2 gap-2">
        {BADGE_CATEGORIES.map((cat) => (
          <CategoryCard key={cat.id} category={cat} value={cat.getValue(stats)} />
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-geist-hairline dark:border-neutral-800 pt-3">
        <p className="text-[11px] text-geist-mute dark:text-neutral-500 uppercase tracking-wide font-medium mb-2">
          Special Badges
        </p>
        <div className="flex flex-col gap-1.5">
          {SPECIAL_BADGES.map((badge) => (
            <SpecialBadgeCard key={badge.id} badge={badge} earned={badge.check(stats)} />
          ))}
        </div>
      </div>

      {/* Tier legend */}
      <div className="border-t border-geist-hairline dark:border-neutral-800 pt-3">
        <p className="text-[10px] text-geist-mute dark:text-neutral-600 mb-1.5 uppercase tracking-wide">
          Tier progression
        </p>
        <div className="flex flex-wrap gap-1">
          {(['iron', 'bronze', 'silver', 'gold', 'platinum', 'diamond'] as Tier[]).map((tier) => (
            <TierBadgePill key={tier} tier={tier} />
          ))}
        </div>
      </div>
    </div>
  );
}
