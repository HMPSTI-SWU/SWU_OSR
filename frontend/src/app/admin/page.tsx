'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/api';
import type { Role, Skill } from '@/types/user';
import {
  Shield,
  Search,
  Users,
  ChevronDown,
  Check,
  AlertCircle,
  Loader2,
  GraduationCap,
  BookOpen,
  Star,
  User,
  Zap,
  Plus,
  Trash2,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AdminUser {
  id: string;
  nim: string;
  full_name: string;
  alias: string;
  github_username: string;
  avatar_url: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

// ─── Role Config ─────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<
  Role,
  { label: string; icon: React.ReactNode; badgeClass: string; bg: string }
> = {
  student: {
    label: 'Student',
    icon: <User className="h-3 w-3" />,
    badgeClass: 'text-sky-600 dark:text-sky-400',
    bg: 'bg-sky-500/10 border border-sky-500/20',
  },
  faculty: {
    label: 'Dosen',
    icon: <GraduationCap className="h-3 w-3" />,
    badgeClass: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10 border border-amber-500/20',
  },
  lpt_officer: {
    label: 'LPT Officer',
    icon: <BookOpen className="h-3 w-3" />,
    badgeClass: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-500/10 border border-violet-500/20',
  },
  super_admin: {
    label: 'Super Admin',
    icon: <Star className="h-3 w-3" />,
    badgeClass: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-500/10 border border-rose-500/20',
  },
};

const ASSIGNABLE_ROLES: Role[] = ['student', 'faculty', 'lpt_officer'];

// ─── Role Badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: Role }) {
  const cfg = ROLE_CONFIG[role] ?? ROLE_CONFIG.student;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.badgeClass}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ─── Role Dropdown ────────────────────────────────────────────────────────────

function RoleDropdown({
  userId,
  currentRole,
  disabled,
}: {
  userId: string;
  currentRole: Role;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (newRole: Role) => {
      await api.put(`/admin/users/${userId}/role`, { role: newRole });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    },
  });

  if (disabled || currentRole === 'super_admin') {
    return <RoleBadge role={currentRole} />;
  }

  return (
    <div className="relative">
      <button
        id={`role-dropdown-${userId}`}
        onClick={() => setOpen((v) => !v)}
        disabled={mutation.isPending}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors text-[12px] font-medium text-neutral-700 dark:text-neutral-300 disabled:opacity-50"
      >
        {mutation.isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : success ? (
          <Check className="h-3 w-3 text-emerald-500" />
        ) : (
          ROLE_CONFIG[currentRole]?.icon
        )}
        {ROLE_CONFIG[currentRole]?.label ?? currentRole}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 min-w-[160px] bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-lg overflow-hidden">
            {ASSIGNABLE_ROLES.map((role) => (
              <button
                key={role}
                onClick={() => {
                  setOpen(false);
                  if (role !== currentRole) mutation.mutate(role);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-[12px] font-medium hover:bg-neutral-50 dark:hover:bg-neutral-700/60 transition-colors ${
                  role === currentRole
                    ? 'text-geist-ink dark:text-white bg-neutral-50 dark:bg-neutral-700/40'
                    : 'text-neutral-600 dark:text-neutral-300'
                }`}
              >
                <span className={ROLE_CONFIG[role].badgeClass}>{ROLE_CONFIG[role].icon}</span>
                {ROLE_CONFIG[role].label}
                {role === currentRole && <Check className="h-3 w-3 ml-auto text-emerald-500" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-neutral-100 dark:border-neutral-800/60">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-3.5 w-24" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-5 w-20 rounded-full" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-3.5 w-20" />
      </td>
      <td className="px-4 py-3 text-right">
        <Skeleton className="h-7 w-28 rounded-lg ml-auto" />
      </td>
    </tr>
  );
}

const SKILL_CATEGORIES = [
  'Backend',
  'Frontend',
  'Mobile',
  'DevOps',
  'Database',
  'Tools',
  'AI/ML',
  'General',
];

// ─── Skill Admin Panel ────────────────────────────────────────────────────────

function SkillAdminTab() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('General');
  const [deletingID, setDeletingID] = useState<string | null>(null);

  const { data: skills = [], isLoading } = useQuery<Skill[]>({
    queryKey: ['allSkills'],
    queryFn: async () => {
      const { data } = await api.get<{ ok: boolean; data: Skill[] }>('/skills');
      return data.data ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/admin/skills', { name, category });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allSkills'] });
      setName('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/skills/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allSkills'] });
      setDeletingID(null);
    },
    onSettled: () => setDeletingID(null),
  });

  // Group skills by category
  const grouped = skills.reduce<Record<string, Skill[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Add skill form */}
      <Card>
        <CardContent className="p-4">
          <p className="text-caption font-semibold text-geist-ink dark:text-white mb-3">
            Tambah Skill Baru
          </p>
          <div className="flex gap-2">
            <input
              id="admin-skill-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama skill (mis. Svelte)"
              className="flex-1 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-geist-ink dark:text-white placeholder:text-geist-mute dark:placeholder:text-neutral-500 outline-none focus:ring-2 focus:ring-geist-ink/10 dark:focus:ring-white/10"
            />
            <select
              id="admin-skill-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-geist-ink dark:text-white outline-none"
            >
              {SKILL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              id="admin-skill-add"
              onClick={() => name.trim() && createMutation.mutate()}
              disabled={createMutation.isPending || !name.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-geist-ink dark:bg-white text-white dark:text-black text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Tambah
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Skill list grouped by category */}
      <Card>
        <div className="p-4 border-b border-neutral-100 dark:border-neutral-800/60 flex items-center justify-between">
          <span className="text-caption font-semibold text-geist-ink dark:text-white">
            Master Skill List
          </span>
          <span className="text-caption text-geist-mute dark:text-neutral-500">
            {skills.length} skill
          </span>
        </div>
        {isLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="h-5 w-5 animate-spin mx-auto text-geist-mute" />
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
            {Object.entries(grouped).map(([cat, catSkills]) => (
              <div key={cat} className="px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-geist-mute dark:text-neutral-500 mb-2">
                  {cat}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {catSkills.map((s) => (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-xs font-medium text-geist-ink dark:text-white"
                    >
                      {s.name}
                      <button
                        onClick={() => {
                          setDeletingID(s.id);
                          deleteMutation.mutate(s.id);
                        }}
                        disabled={deletingID === s.id}
                        className="p-0.5 rounded-full text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40"
                        title={`Hapus ${s.name}`}
                      >
                        {deletingID === s.id ? (
                          <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-2.5 w-2.5" />
                        )}
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const { data: currentUser, isLoading: isLoadingUser } = useCurrentUser();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'skills'>('users');

  // Guard: redirect non-admins
  useEffect(() => {
    if (!isLoadingUser && currentUser && currentUser.role !== 'super_admin') {
      router.replace('/dashboard');
    }
    if (!isLoadingUser && !currentUser) {
      router.replace('/welcome');
    }
  }, [currentUser, isLoadingUser, router]);

  const {
    data: users,
    isLoading,
    isError,
  } = useQuery<AdminUser[]>({
    queryKey: ['adminUsers'],
    queryFn: async () => {
      const { data } = await api.get<{ ok: boolean; data: AdminUser[] }>('/admin/users');
      return data.data;
    },
    enabled: currentUser?.role === 'super_admin',
  });

  const filtered = (users ?? []).filter(
    (u) =>
      u.alias.toLowerCase().includes(search.toLowerCase()) ||
      u.nim.includes(search) ||
      u.full_name.toLowerCase().includes(search.toLowerCase())
  );

  // Stats
  const roleCounts = (users ?? []).reduce<Record<string, number>>(
    (acc, u) => ({ ...acc, [u.role]: (acc[u.role] ?? 0) + 1 }),
    {}
  );

  if (isLoadingUser) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-geist-mute dark:text-neutral-500" />
      </div>
    );
  }

  if (!currentUser || currentUser.role !== 'super_admin') return null;

  return (
    <div className="mx-auto max-w-geist-page px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <Shield className="h-5 w-5 text-rose-500" />
          </div>
          <h1 className="text-display-lg text-geist-ink dark:text-white">Admin Panel</h1>
        </div>
        <p className="text-body-sm text-geist-body dark:text-neutral-400 ml-12">
          Kelola role pengguna platform ORBIT. Perubahan role berlaku saat token JWT pengguna
          diperbarui (login ulang).
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-neutral-100 dark:bg-neutral-800/60 rounded-xl p-1 w-fit">
        {(['users', 'skills'] as const).map((tab) => (
          <button
            key={tab}
            id={`admin-tab-${tab}`}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-white dark:bg-neutral-700 text-geist-ink dark:text-white shadow-sm'
                : 'text-geist-mute dark:text-neutral-400 hover:text-geist-ink dark:hover:text-white'
            }`}
          >
            {tab === 'users' ? <Users className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
            {tab === 'users' ? 'Pengguna' : 'Skills'}
          </button>
        ))}
      </div>

      {activeTab === 'skills' ? (
        <SkillAdminTab />
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {(Object.keys(ROLE_CONFIG) as Role[]).map((role) => {
              const cfg = ROLE_CONFIG[role];
              const count = roleCounts[role] ?? 0;
              return (
                <Card key={role} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`${cfg.badgeClass}`}>{cfg.icon}</span>
                      <span className="text-display-lg font-bold text-geist-ink dark:text-white">
                        {count}
                      </span>
                    </div>
                    <p className="text-caption text-geist-mute dark:text-neutral-500">
                      {cfg.label}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Search & Table */}
          <Card>
            {/* Search bar */}
            <div className="p-4 border-b border-neutral-100 dark:border-neutral-800/60 flex items-center gap-3">
              <Search className="h-4 w-4 text-geist-mute dark:text-neutral-500 shrink-0" />
              <input
                id="admin-search"
                type="text"
                placeholder="Cari berdasarkan alias, NIM, atau nama..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-body-sm text-geist-ink dark:text-white placeholder:text-geist-mute dark:placeholder:text-neutral-500 outline-none"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="text-xs text-geist-mute dark:text-neutral-500 hover:text-geist-ink dark:hover:text-white transition-colors"
                >
                  clear
                </button>
              )}
              <div className="flex items-center gap-1.5 text-caption text-geist-mute dark:text-neutral-500">
                <Users className="h-3.5 w-3.5" />
                <span>{filtered.length} pengguna</span>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 dark:border-neutral-800/60">
                    <th className="px-4 py-3 text-left text-caption font-semibold text-geist-mute dark:text-neutral-500 whitespace-nowrap">
                      Pengguna
                    </th>
                    <th className="px-4 py-3 text-left text-caption font-semibold text-geist-mute dark:text-neutral-500 whitespace-nowrap">
                      NIM
                    </th>
                    <th className="px-4 py-3 text-left text-caption font-semibold text-geist-mute dark:text-neutral-500 whitespace-nowrap">
                      Role Saat Ini
                    </th>
                    <th className="px-4 py-3 text-left text-caption font-semibold text-geist-mute dark:text-neutral-500 whitespace-nowrap">
                      Bergabung
                    </th>
                    <th className="px-4 py-3 text-right text-caption font-semibold text-geist-mute dark:text-neutral-500 whitespace-nowrap">
                      Ubah Role
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                  ) : isError ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center gap-2 text-geist-mute dark:text-neutral-500">
                          <AlertCircle className="h-8 w-8" />
                          <p className="text-body-sm">Gagal memuat data pengguna.</p>
                        </div>
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center">
                        <p className="text-body-sm text-geist-mute dark:text-neutral-500">
                          {search
                            ? `Tidak ada pengguna dengan kata kunci "${search}"`
                            : 'Belum ada pengguna.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((user) => (
                      <tr
                        key={user.id}
                        className={`border-b border-neutral-100 dark:border-neutral-800/60 last:border-0 transition-colors hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20 ${
                          user.id === currentUser?.id ? 'bg-rose-50/30 dark:bg-rose-900/10' : ''
                        }`}
                      >
                        {/* User info */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {user.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={user.avatar_url}
                                alt={user.alias}
                                className="h-9 w-9 rounded-full object-cover shrink-0 ring-1 ring-neutral-200 dark:ring-neutral-700"
                              />
                            ) : (
                              <div className="h-9 w-9 rounded-full bg-neutral-200 dark:bg-neutral-700 shrink-0 flex items-center justify-center text-xs font-bold text-neutral-500">
                                {user.alias[0]?.toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="text-caption font-semibold text-geist-ink dark:text-white">
                                  {user.alias}
                                </p>
                                {user.id === currentUser?.id && (
                                  <span className="text-[10px] font-semibold text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-full px-1.5 py-0.5">
                                    You
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-geist-mute dark:text-neutral-500">
                                {user.full_name || `@${user.github_username}`}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* NIM */}
                        <td className="px-4 py-3">
                          <span className="font-mono text-[12px] text-geist-body dark:text-neutral-400">
                            {user.nim}
                          </span>
                        </td>

                        {/* Current Role Badge */}
                        <td className="px-4 py-3">
                          <RoleBadge role={user.role} />
                        </td>

                        {/* Join date */}
                        <td className="px-4 py-3">
                          <span className="text-[12px] text-geist-mute dark:text-neutral-500">
                            {new Date(user.created_at).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </td>

                        {/* Role Dropdown */}
                        <td className="px-4 py-3 text-right">
                          <RoleDropdown
                            userId={user.id}
                            currentRole={user.role}
                            disabled={user.id === currentUser?.id}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer note */}
            <div className="px-4 py-3 border-t border-neutral-100 dark:border-neutral-800/60 flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-geist-mute dark:text-neutral-500 leading-relaxed">
                Role <strong className="text-rose-500">super_admin</strong> tidak dapat diberikan
                atau dicabut melalui panel ini — hanya bisa diubah melalui variabel{' '}
                <code className="font-mono bg-neutral-100 dark:bg-neutral-800 px-1 rounded">
                  SUPER_ADMIN_NIMS
                </code>{' '}
                di file{' '}
                <code className="font-mono bg-neutral-100 dark:bg-neutral-800 px-1 rounded">
                  .env
                </code>{' '}
                server. Perubahan role akan aktif setelah pengguna melakukan login ulang.
              </p>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
