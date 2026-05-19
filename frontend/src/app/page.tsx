"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useAuth";
import { ActivityFeed } from "@/features/feed/ActivityFeed";
import { OnboardingPrompt } from "@/features/profile/OnboardingPrompt";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import api from "@/lib/api";
import {
  Code2,
  GitBranch,
  Users,
  FolderGit2,
  MessageSquare,
  Trophy,
  ArrowRight,
  Zap,
  Shield,
  Globe,
  TrendingUp,
  ExternalLink,
  Activity,
} from "lucide-react";

// --- Types ---
interface CommunityStats {
  total_members: number;
  total_repos: number;
  total_activities: number;
  active_today: number;
  top_languages: string[];
  commits_this_week: number;
}

interface PopularRepo {
  id: string;
  repo_name: string;
  repo_full_name: string;
  description: string;
  language: string;
  html_url: string;
  academic_tag: string;
  owner_alias: string;
  owner_avatar: string;
  activity_count: number;
}

// --- Landing Page (visitors) ---
function HeroSection() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-24 sm:py-32">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 mb-8">
            <div className="h-2 w-2 bg-millennium-cyan" />
            <span className="text-xs font-bold text-millennium-slate uppercase tracking-widest">
              Open Source Platform for Students
            </span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-millennium-black leading-[0.95] tracking-tight">
            Showcase Your Code,{" "}
            <span className="text-millennium-cyan">Build Your Future</span>
          </h1>

          <p className="mt-8 text-lg text-millennium-slate max-w-2xl leading-relaxed">
            Platform mahasiswa STMIK Widya Utama untuk menampilkan proyek open source,
            berkolaborasi dengan peers, dan membangun portofolio profesional.
          </p>

          <div className="mt-10 flex items-center gap-4">
            <Link href="/login">
              <Button size="lg">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/members">
              <Button variant="outline" size="lg">
                <Users className="mr-2 h-4 w-4" />
                Browse Members
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    { icon: FolderGit2, title: "Project Showcase", description: "Tampilkan repository GitHub terbaik kamu dengan tag akademik." },
    { icon: Zap, title: "Activity Tracking", description: "Webhook otomatis mencatat setiap push, PR, dan release." },
    { icon: MessageSquare, title: "Discussions", description: "Forum per-repository untuk review kode dan kolaborasi." },
    { icon: Shield, title: "Pseudonymous Identity", description: "Gunakan alias publik. Identitas hanya terlihat sesama pengguna." },
    { icon: Trophy, title: "Badges & Streaks", description: "Dapatkan badges berdasarkan pencapaian dan konsistensi." },
    { icon: Globe, title: "Public Portfolio", description: "Profil publik yang bisa dibagikan ke recruiter atau siapa saja." },
  ];

  return (
    <section className="py-24 bg-millennium-off-white border-t border-millennium-border">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-16">
          <h2 className="text-3xl sm:text-4xl font-black text-millennium-black tracking-tight">
            Everything You Need to{" "}
            <span className="text-millennium-cyan">Stand Out</span>
          </h2>
          <p className="mt-4 text-millennium-slate max-w-xl">
            Satu platform untuk semua kebutuhan portofolio open source mahasiswa.
          </p>
        </div>
        <div className="grid gap-px bg-millennium-border sm:grid-cols-2 lg:grid-cols-3 border border-millennium-border">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="bg-white p-8">
                <div className="h-10 w-10 bg-millennium-cyan flex items-center justify-center mb-6">
                  <Icon className="h-5 w-5 text-white" strokeWidth={2.5} />
                </div>
                <h3 className="text-base font-extrabold text-millennium-black mb-2 tracking-tight">
                  {feature.title}
                </h3>
                <p className="text-sm text-millennium-slate leading-relaxed">
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
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="bg-millennium-black p-12 sm:p-16">
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-4">
            Ready to Build Your Portfolio?
          </h2>
          <p className="text-millennium-slate-mid max-w-xl mb-8 text-base">
            Mulai showcase karya open source kamu hari ini. Login dengan akun SIAKAD dan hubungkan GitHub.
          </p>
          <Link href="/login">
            <Button className="bg-millennium-cyan text-white hover:bg-millennium-cyan-dark" size="lg">
              Start Now — It&apos;s Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

// --- Community Dashboard (logged-in users) ---
function CommunityStatsBar({ stats }: { stats: CommunityStats | undefined }) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-millennium-border border border-millennium-border">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 bg-white" />
        ))}
      </div>
    );
  }

  const items = [
    { label: "Members", value: stats.total_members },
    { label: "Repositories", value: stats.total_repos },
    { label: "This Week", value: stats.commits_this_week },
    { label: "Active Today", value: stats.active_today },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-millennium-border border border-millennium-border">
      {items.map((item) => (
        <div key={item.label} className="bg-white p-6">
          <p className="text-4xl font-black text-millennium-black tracking-tight leading-none">
            {item.value}
          </p>
          <p className="text-xs font-semibold text-millennium-slate-mid uppercase tracking-widest mt-2">
            {item.label}
          </p>
        </div>
      ))}
    </div>
  );
}

function PopularReposSection({ repos }: { repos: PopularRepo[] | undefined }) {
  if (!repos || repos.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="flex items-baseline justify-between mb-6">
        <h2 className="text-lg font-extrabold text-millennium-black uppercase tracking-wide">
          Popular Repositories
        </h2>
        <Link href="/showcase" className="text-xs font-bold text-millennium-cyan uppercase tracking-wider hover:text-millennium-cyan-dark transition-colors">
          View all
        </Link>
      </div>
      <div className="grid gap-px bg-millennium-border sm:grid-cols-2 lg:grid-cols-3 border border-millennium-border">
        {repos.map((repo) => (
          <a
            key={repo.id}
            href={repo.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-white p-5 hover:bg-millennium-off-white transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="font-extrabold text-sm text-millennium-black group-hover:text-millennium-cyan transition-colors truncate">
                {repo.repo_name}
              </span>
              <ExternalLink className="h-3.5 w-3.5 text-millennium-slate-mid opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
            </div>
            <p className="text-xs text-millennium-slate line-clamp-2 mb-4">
              {repo.description || "No description"}
            </p>
            <div className="flex items-center gap-3">
              {repo.language && (
                <Badge variant="outline" className="text-[10px] py-0.5 px-2 border">
                  {repo.language}
                </Badge>
              )}
              <Badge variant="secondary" className="text-[10px] py-0.5 px-2">
                {repo.academic_tag.replace("_", " ")}
              </Badge>
              {repo.activity_count > 0 && (
                <span className="text-[10px] font-bold text-millennium-cyan ml-auto">
                  {repo.activity_count} acts
                </span>
              )}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

function TrendingLanguages({ languages }: { languages: string[] }) {
  if (!languages || languages.length === 0) return null;

  return (
    <div className="border border-millennium-border bg-white p-6">
      <h3 className="text-xs font-extrabold text-millennium-black uppercase tracking-widest mb-4">
        Trending Languages
      </h3>
      <div className="flex flex-wrap gap-2">
        {languages.map((lang) => (
          <span
            key={lang}
            className="px-3 py-1 text-xs font-bold text-millennium-slate border-2 border-millennium-border hover:border-millennium-cyan hover:text-millennium-cyan transition-colors"
          >
            {lang}
          </span>
        ))}
      </div>
    </div>
  );
}

function ActiveMembersSection() {
  const { data: membersData } = useQuery<{ members: Array<{ id: string; alias: string; avatar_url: string; github_username: string }> }>({
    queryKey: ["membersPreview"],
    queryFn: async () => {
      const { data } = await api.get<{ ok: boolean; data: { members: Array<{ id: string; alias: string; avatar_url: string; github_username: string }>; total: number } }>("/members");
      return data.data;
    },
  });

  const members = membersData?.members ?? [];
  if (members.length === 0) return null;

  return (
    <div className="border border-millennium-border bg-white p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-xs font-extrabold text-millennium-black uppercase tracking-widest">
          Community
        </h3>
        <Link href="/members" className="text-[10px] font-bold text-millennium-cyan uppercase tracking-wider">
          All
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {members.slice(0, 12).map((member) => (
          <Link key={member.id} href={`/profiles/${member.alias}`} title={member.alias}>
            <Avatar
              src={member.avatar_url}
              alt={member.alias}
              fallback={member.alias.charAt(0).toUpperCase()}
              size="sm"
              className="h-9 w-9 hover:opacity-70 transition-opacity"
            />
          </Link>
        ))}
        {members.length > 12 && (
          <Link
            href="/members"
            className="h-9 w-9 bg-millennium-off-white border border-millennium-border flex items-center justify-center text-xs font-bold text-millennium-slate-mid hover:border-millennium-cyan hover:text-millennium-cyan transition-colors"
          >
            +{members.length - 12}
          </Link>
        )}
      </div>
    </div>
  );
}

// --- Main Page Component ---
export default function HomePage() {
  const { data: user } = useCurrentUser();

  const { data: stats } = useQuery<CommunityStats>({
    queryKey: ["communityStats"],
    queryFn: async () => {
      const { data } = await api.get<{ ok: boolean; data: CommunityStats }>("/stats");
      return data.data;
    },
    enabled: !!user,
  });

  const { data: popularRepos } = useQuery<PopularRepo[]>({
    queryKey: ["popularRepos"],
    queryFn: async () => {
      const { data } = await api.get<{ ok: boolean; data: PopularRepo[] }>("/repos/popular");
      return data.data;
    },
    enabled: !!user,
  });

  // Logged-in: Community Dashboard
  if (user) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        {/* Header — flush left, no decoration */}
        <header className="mb-10 border-b border-millennium-border pb-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-millennium-cyan uppercase tracking-widest mb-2">
                Dashboard
              </p>
              <h1 className="text-3xl sm:text-4xl font-black text-millennium-black tracking-tight">
                Welcome back, {user.alias}
              </h1>
              <p className="text-sm text-millennium-slate mt-2">
                Here&apos;s what&apos;s happening in the community.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/showcase">
                <Button variant="outline" size="sm">
                  <FolderGit2 className="h-3.5 w-3.5 mr-2" />
                  Showcase
                </Button>
              </Link>
              <Link href={`/profiles/${user.alias}`}>
                <Button variant="ghost" size="sm">
                  <Trophy className="h-3.5 w-3.5 mr-2" />
                  Profile
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <OnboardingPrompt />

        {/* Community Stats — rigid grid, blocky */}
        <div className="mb-12">
          <CommunityStatsBar stats={stats} />
        </div>

        {/* Main content: 12-col grid (8 + 4) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Main content (8 cols) */}
          <div className="lg:col-span-8 space-y-12">
            <PopularReposSection repos={popularRepos} />

            {/* Activity Feed */}
            <section>
              <h2 className="text-lg font-extrabold text-millennium-black uppercase tracking-wide mb-6">
                Recent Activity
              </h2>
              <ActivityFeed />
            </section>
          </div>

          {/* Right sidebar (4 cols) */}
          <aside className="lg:col-span-4 space-y-6">
            {stats && stats.top_languages.length > 0 && (
              <TrendingLanguages languages={stats.top_languages} />
            )}

            <ActiveMembersSection />

            {/* Quick Links */}
            <div className="border border-millennium-border bg-white p-6">
              <h3 className="text-xs font-extrabold text-millennium-black uppercase tracking-widest mb-4">
                Quick Links
              </h3>
              <nav className="space-y-3">
                <Link href="/showcase" className="flex items-center gap-3 text-sm text-millennium-slate font-medium hover:text-millennium-cyan transition-colors">
                  <FolderGit2 className="h-4 w-4" />
                  Manage Showcase
                </Link>
                <Link href="/members" className="flex items-center gap-3 text-sm text-millennium-slate font-medium hover:text-millennium-cyan transition-colors">
                  <Users className="h-4 w-4" />
                  Discover Members
                </Link>
                <Link href="/settings" className="flex items-center gap-3 text-sm text-millennium-slate font-medium hover:text-millennium-cyan transition-colors">
                  <Zap className="h-4 w-4" />
                  Settings
                </Link>
                <a
                  href="https://github.com/FallCatsinSeng/SWU_OSR"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-sm text-millennium-slate font-medium hover:text-millennium-cyan transition-colors"
                >
                  <Globe className="h-4 w-4" />
                  Source Code
                  <ExternalLink className="h-3 w-3 ml-auto" />
                </a>
              </nav>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  // Not logged in: Marketing landing page
  return (
    <div>
      <HeroSection />
      <FeaturesSection />
      <CTASection />
    </div>
  );
}
