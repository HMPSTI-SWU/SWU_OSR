'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useAuth';
import api from '@/lib/api';
import type { UserSkill, EndorserPreview } from '@/types/user';
import {
  Zap,
  Users,
  GraduationCap,
  BookOpen,
  Star,
  Plus,
  Check,
  Loader2,
  ChevronDown,
  ChevronUp,
  User,
} from 'lucide-react';

// ─── Role badge config ────────────────────────────────────────────────────────

const ROLE_ICON: Record<string, React.ReactNode> = {
  faculty: <GraduationCap className="h-2.5 w-2.5" />,
  lpt_officer: <BookOpen className="h-2.5 w-2.5" />,
  super_admin: <Star className="h-2.5 w-2.5" />,
  student: <User className="h-2.5 w-2.5" />,
};

const ROLE_COLOR: Record<string, string> = {
  faculty:
    'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/40',
  lpt_officer:
    'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-700/40',
  super_admin:
    'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-700/40',
  student:
    'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-700/40',
};

// ─── Endorser Avatars ─────────────────────────────────────────────────────────

function EndorserAvatars({ endorsers }: { endorsers: EndorserPreview[] }) {
  if (!endorsers || endorsers.length === 0) return null;
  return (
    <div className="flex -space-x-1.5">
      {endorsers.slice(0, 5).map((e) =>
        e.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={e.user_id}
            src={e.avatar_url}
            alt={e.alias}
            title={`${e.alias} (${e.role})`}
            className="h-5 w-5 rounded-full ring-1 ring-white dark:ring-neutral-900 object-cover"
          />
        ) : (
          <div
            key={e.user_id}
            title={`${e.alias} (${e.role})`}
            className="h-5 w-5 rounded-full ring-1 ring-white dark:ring-neutral-900 bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-[8px] font-bold text-neutral-500"
          >
            {e.alias[0]?.toUpperCase()}
          </div>
        )
      )}
    </div>
  );
}

// ─── Single Skill Card ────────────────────────────────────────────────────────

function SkillCard({
  us,
  isOwn,
  onEndorse,
  onUnendorse,
  isEndorsePending,
}: {
  us: UserSkill;
  isOwn: boolean;
  onEndorse: (id: string) => void;
  onUnendorse: (id: string) => void;
  isEndorsePending: boolean;
}) {
  const [showEndorsers, setShowEndorsers] = useState(false);

  const hasFaculty = us.faculty_count > 0;
  const hasLPT = us.lpt_count > 0;

  return (
    <div className="group relative flex flex-col gap-1.5 p-3 rounded-xl border border-neutral-200 dark:border-neutral-700/60 bg-neutral-50/50 dark:bg-neutral-800/30 hover:border-neutral-300 dark:hover:border-neutral-600 transition-all">
      {/* Skill name + counts */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-semibold text-geist-ink dark:text-white truncate">
            {us.skill.name}
          </span>
          {/* Official verifier badges */}
          {hasLPT && (
            <span
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${ROLE_COLOR.lpt_officer}`}
            >
              <BookOpen className="h-2 w-2" />
              LPT
            </span>
          )}
          {hasFaculty && (
            <span
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${ROLE_COLOR.faculty}`}
            >
              <GraduationCap className="h-2 w-2" />
              Dosen
            </span>
          )}
        </div>

        {/* Endorse button (only if not own profile) */}
        {!isOwn && (
          <button
            id={`endorse-${us.id}`}
            disabled={isEndorsePending}
            onClick={() => (us.is_endorsed_by_me ? onUnendorse(us.id) : onEndorse(us.id))}
            className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-all ${
              us.is_endorsed_by_me
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700/40 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 hover:border-red-200'
                : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-600 hover:bg-sky-50 dark:hover:bg-sky-900/20 hover:text-sky-600 hover:border-sky-200'
            } disabled:opacity-40`}
          >
            {isEndorsePending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : us.is_endorsed_by_me ? (
              <>
                <Check className="h-3 w-3" /> Endorsed
              </>
            ) : (
              <>
                <Plus className="h-3 w-3" /> Endorse
              </>
            )}
          </button>
        )}
      </div>

      {/* Endorsement count row */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => us.endorse_count > 0 && setShowEndorsers((v) => !v)}
          className={`flex items-center gap-1.5 text-[11px] text-geist-mute dark:text-neutral-500 ${us.endorse_count > 0 ? 'hover:text-geist-ink dark:hover:text-white cursor-pointer' : 'cursor-default'} transition-colors`}
        >
          <EndorserAvatars endorsers={us.endorsers} />
          <span>
            {us.endorse_count === 0
              ? 'No endorsements yet'
              : `${us.endorse_count} endorsement${us.endorse_count !== 1 ? 's' : ''}`}
          </span>
          {us.endorse_count > 0 &&
            (showEndorsers ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            ))}
        </button>
      </div>

      {/* Expanded endorser list */}
      {showEndorsers && us.endorsers.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1.5 pt-2 border-t border-neutral-100 dark:border-neutral-700/40">
          {us.endorsers.map((e) => (
            <span
              key={e.user_id}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${ROLE_COLOR[e.role] ?? ROLE_COLOR.student}`}
            >
              {ROLE_ICON[e.role]}
              {e.alias}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main SkillSection ────────────────────────────────────────────────────────

interface SkillSectionProps {
  userID: string;
  skills: UserSkill[];
  isOwn: boolean;
  onRefetch: () => void;
}

export function SkillSection({ userID: _userID, skills, isOwn, onRefetch }: SkillSectionProps) {
  const { data: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const [pendingID, setPendingID] = useState<string | null>(null);

  const endorseMutation = useMutation({
    mutationFn: async (userSkillID: string) => {
      await api.post(`/skills/${userSkillID}/endorse`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      onRefetch();
      setPendingID(null);
    },
    onSettled: () => setPendingID(null),
  });

  const unendorseMutation = useMutation({
    mutationFn: async (userSkillID: string) => {
      await api.delete(`/skills/${userSkillID}/endorse`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      onRefetch();
      setPendingID(null);
    },
    onSettled: () => setPendingID(null),
  });

  if (!skills || skills.length === 0) {
    return (
      <div className="text-center py-6 text-geist-mute dark:text-neutral-500 text-sm">
        {isOwn
          ? 'Kamu belum menambahkan skill. Tambahkan di Settings → Skills.'
          : 'Pengguna ini belum menambahkan skill.'}
      </div>
    );
  }

  // Group by category
  const grouped = skills.reduce<Record<string, UserSkill[]>>((acc, us) => {
    const cat = us.skill.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(us);
    return acc;
  }, {});

  const isViewerLoggedIn = !!currentUser;

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([category, categorySkills]) => (
        <div key={category}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-geist-mute dark:text-neutral-500">
              {category}
            </span>
            <div className="flex-1 h-px bg-neutral-100 dark:bg-neutral-800" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {categorySkills.map((us) => (
              <SkillCard
                key={us.id}
                us={us}
                isOwn={isOwn || !isViewerLoggedIn}
                onEndorse={(id) => {
                  setPendingID(id);
                  endorseMutation.mutate(id);
                }}
                onUnendorse={(id) => {
                  setPendingID(id);
                  unendorseMutation.mutate(id);
                }}
                isEndorsePending={pendingID === us.id}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Legend for non-logged-in viewers */}
      {!isViewerLoggedIn && (
        <p className="text-[11px] text-geist-mute dark:text-neutral-500 text-center pt-1">
          <a href="/login" className="underline hover:text-geist-ink">
            Login
          </a>{' '}
          untuk memberikan endorsement.
        </p>
      )}

      {/* Summary stats */}
      <div className="flex items-center justify-end gap-4 pt-1">
        <span className="flex items-center gap-1 text-[11px] text-geist-mute dark:text-neutral-500">
          <Users className="h-3 w-3" />
          {skills.reduce((acc, s) => acc + s.endorse_count, 0)} total endorsements
        </span>
        <span className="flex items-center gap-1 text-[11px] text-geist-mute dark:text-neutral-500">
          <Zap className="h-3 w-3" />
          {skills.length}/{15} skills
        </span>
      </div>
    </div>
  );
}
