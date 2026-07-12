'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useAuth';
import api from '@/lib/api';
import type { Skill, UserSkill } from '@/types/user';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { Zap, Plus, X, Search, Loader2, AlertCircle } from 'lucide-react';

const MAX_SKILLS = 15;

interface SkillPillProps {
  skill: UserSkill;
  onRemove: (skillID: string) => void;
  isRemoving: boolean;
}

function SkillPill({ skill, onRemove, isRemoving }: SkillPillProps) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-full text-sm font-medium text-geist-ink dark:text-white">
      <span>{skill.skill.name}</span>
      <span className="text-[10px] text-geist-mute dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-700 rounded-full px-1.5 py-0.5">
        {skill.skill.category}
      </span>
      <button
        onClick={() => onRemove(skill.skill.id)}
        disabled={isRemoving}
        className="ml-0.5 p-0.5 rounded-full text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40"
        title={`Remove ${skill.skill.name}`}
      >
        {isRemoving ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
      </button>
    </div>
  );
}

export function SkillManager() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [removingID, setRemovingID] = useState<string | null>(null);
  const [addingID, setAddingID] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Fetch master skill list
  const { data: allSkills = [] } = useQuery<Skill[]>({
    queryKey: ['allSkills'],
    queryFn: async () => {
      const { data } = await api.get<{ ok: boolean; data: Skill[] }>('/skills');
      return data.data ?? [];
    },
  });

  // Fetch user's current skills
  const { data: mySkills = [], refetch: refetchMySkills } = useQuery<UserSkill[]>({
    queryKey: ['skills', user?.id],
    queryFn: async () => {
      const { data } = await api.get<{ ok: boolean; data: UserSkill[] }>(
        `/users/${user!.id}/skills`
      );
      return data.data ?? [];
    },
    enabled: !!user?.id,
  });

  const mySkillIDs = useMemo(() => new Set(mySkills.map((s) => s.skill.id)), [mySkills]);

  // Filter available skills by search (exclude already-added)
  const filtered = useMemo(
    () =>
      allSkills.filter(
        (s) => !mySkillIDs.has(s.id) && s.name.toLowerCase().includes(search.toLowerCase())
      ),
    [allSkills, mySkillIDs, search]
  );

  // Group filtered by category
  const groupedFiltered = useMemo(() => {
    return filtered.reduce<Record<string, Skill[]>>((acc, s) => {
      if (!acc[s.category]) acc[s.category] = [];
      acc[s.category].push(s);
      return acc;
    }, {});
  }, [filtered]);

  const addMutation = useMutation({
    mutationFn: async (skillID: string) => {
      await api.post('/profile/skills', { skill_id: skillID });
    },
    onSuccess: () => {
      refetchMySkills();
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setSearch('');
      setShowDropdown(false);
      setAddingID(null);
    },
    onError: (err: any) => {
      toast(err?.response?.data?.error || 'Gagal menambahkan skill', 'error');
      setAddingID(null);
    },
    onSettled: () => setAddingID(null),
  });

  const removeMutation = useMutation({
    mutationFn: async (skillID: string) => {
      await api.delete(`/profile/skills/${skillID}`);
    },
    onSuccess: () => {
      refetchMySkills();
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setRemovingID(null);
    },
    onError: (err: any) => {
      toast(err?.response?.data?.error || 'Gagal menghapus skill', 'error');
      setRemovingID(null);
    },
    onSettled: () => setRemovingID(null),
  });

  const isAtLimit = mySkills.length >= MAX_SKILLS;

  return (
    <Card id="skills">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          Skills
          <span className="ml-auto text-xs font-normal text-geist-mute dark:text-neutral-500">
            {mySkills.length}/{MAX_SKILLS}
          </span>
        </CardTitle>
        <p className="text-xs text-geist-mute dark:text-neutral-500 mt-0.5">
          Tambahkan skill ke profilmu. Anggota lain dan dosen bisa memberikan endorsement.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Skills */}
        {mySkills.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {mySkills.map((us) => (
              <SkillPill
                key={us.id}
                skill={us}
                onRemove={(skillID) => {
                  setRemovingID(skillID);
                  removeMutation.mutate(skillID);
                }}
                isRemoving={removingID === us.skill.id}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-geist-mute dark:text-neutral-500">
            Belum ada skill. Cari dan tambahkan dari daftar di bawah.
          </p>
        )}

        {/* Search & Add */}
        {isAtLimit ? (
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            Kamu sudah mencapai batas maksimal {MAX_SKILLS} skill. Hapus beberapa untuk menambah
            skill baru.
          </div>
        ) : (
          <div className="relative">
            {/* Search input */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus-within:ring-2 focus-within:ring-geist-ink/10 dark:focus-within:ring-white/10 transition-all">
              <Search className="h-4 w-4 text-geist-mute dark:text-neutral-500 shrink-0" />
              <input
                id="skill-search"
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Cari skill (mis. Go, Docker, React)..."
                className="flex-1 bg-transparent text-sm text-geist-ink dark:text-white placeholder:text-geist-mute dark:placeholder:text-neutral-500 outline-none"
              />
              {search && (
                <button
                  onClick={() => {
                    setSearch('');
                    setShowDropdown(false);
                  }}
                  className="text-geist-mute hover:text-geist-ink transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Dropdown results */}
            {showDropdown && (search || filtered.length > 0) && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
                <div className="absolute top-full left-0 right-0 mt-1 z-20 max-h-64 overflow-y-auto bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-lg">
                  {filtered.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-center text-geist-mute dark:text-neutral-500">
                      {search
                        ? `Skill "${search}" tidak ditemukan.`
                        : 'Semua skill sudah ditambahkan.'}
                    </div>
                  ) : (
                    Object.entries(groupedFiltered).map(([category, skills]) => (
                      <div key={category}>
                        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-geist-mute dark:text-neutral-500 bg-neutral-50 dark:bg-neutral-700/40 border-b border-neutral-100 dark:border-neutral-700">
                          {category}
                        </div>
                        {skills.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => {
                              setAddingID(s.id);
                              addMutation.mutate(s.id);
                            }}
                            disabled={addingID === s.id}
                            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700/60 transition-colors text-left disabled:opacity-50"
                          >
                            <span className="text-geist-ink dark:text-white font-medium">
                              {s.name}
                            </span>
                            {addingID === s.id ? (
                              <Loader2 className="h-3.5 w-3.5 text-geist-mute animate-spin" />
                            ) : (
                              <Plus className="h-3.5 w-3.5 text-geist-mute dark:text-neutral-500" />
                            )}
                          </button>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
