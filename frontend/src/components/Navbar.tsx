'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useCurrentUser, useLogout, useAuthReady } from '@/hooks/useAuth';
import { NotificationBell } from '@/features/forum/NotificationBell';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import {
  LogOut,
  Settings,
  User,
  Menu,
  X,
  Home,
  FolderGit2,
  Users,
  Trophy,
  Shield,
} from 'lucide-react';
import logoOrbit from '@/assets/logo orbit.png';

const NAV_LINKS_AUTH = [
  { href: '/dashboard', label: 'Feed', icon: Home },
  { href: '/showcase', label: 'Showcase', icon: FolderGit2 },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/members', label: 'Members', icon: Users },
];

const NAV_LINKS_PUBLIC = [
  { href: '/feed', label: 'Feed', icon: Home },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/members', label: 'Members', icon: Users },
];

export function Navbar() {
  const { data: user } = useCurrentUser();
  const { isReady, isAuthenticated } = useAuthReady();
  const logout = useLogout();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Pages that REQUIRE authentication — only these should show auth navbar
  // while user data is still loading (to avoid flash).
  // Note: /profiles/*, /repos/*, /members are PUBLIC pages, so they must NOT be here.
  const isStrictAuthPage =
    pathname === '/dashboard' || pathname === '/showcase' || pathname === '/settings';

  // Show auth nav links when:
  // 1. User is actually loaded (definitive), OR
  // 2. We're on a strict auth-only page (so navbar doesn't flash while loading)
  const showAuthLinks = !!user || isStrictAuthPage;

  const navLinks = showAuthLinks ? NAV_LINKS_AUTH : NAV_LINKS_PUBLIC;

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/' || pathname === '/dashboard';
    if (href === '/feed') return pathname === '/feed';
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Geist nav-bar: sticky, 64px, white bg, bottom hairline */}
      <nav className="sticky top-0 z-50 h-16 border-b border-geist-hairline bg-geist-canvas dark:border-neutral-800 dark:bg-black">
        <div className="mx-auto max-w-geist-page px-6 h-full">
          <div className="flex h-full items-center justify-between">
            {/* Left: Logo + Nav links */}
            <div className="flex items-center gap-8">
              {/* Logo */}
              <Link
                href={showAuthLinks ? '/dashboard' : '/feed'}
                className="flex items-center gap-2"
              >
                <Image
                  src={logoOrbit}
                  alt="ORBIT Logo"
                  width={40}
                  height={40}
                  className="dark:invert"
                  priority
                />
                <span className="text-body-sm-strong text-geist-ink dark:text-white hidden sm:inline">
                  ORBIT
                </span>
              </Link>

              {/* Desktop Navigation — centre link row */}
              <div className="hidden md:flex items-center gap-1">
                {navLinks.map((link) => {
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`px-3 py-2 rounded-geist-full text-body-sm transition-colors ${
                        isActive(link.href)
                          ? 'text-geist-ink bg-geist-canvas-soft-2 dark:text-white dark:bg-neutral-800'
                          : 'text-geist-body hover:text-geist-ink dark:text-white dark:hover:text-white'
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Right: CTAs */}
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <NotificationBell />
                  <DropdownMenu
                    trigger={
                      <div className="flex items-center cursor-pointer p-1 rounded-geist-full hover:bg-geist-canvas-soft dark:hover:bg-neutral-800 transition-colors">
                        <Avatar
                          src={user.avatar_url}
                          alt={user.alias}
                          fallback={user.alias.charAt(0).toUpperCase()}
                          size="sm"
                        />
                      </div>
                    }
                  >
                    <div className="px-3 py-2 border-b border-geist-hairline dark:border-neutral-800 max-w-[200px]">
                      <p className="text-body-sm-strong text-geist-ink dark:text-white break-words">
                        {user.alias}
                      </p>
                      <p className="text-caption text-geist-mute dark:text-white truncate">
                        {user.nim}
                      </p>
                    </div>
                    <DropdownMenuItem>
                      <Link href={`/profiles/${user.alias}`} className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Link href="/settings" className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    {user.role === 'super_admin' && (
                      <DropdownMenuItem>
                        <Link
                          href="/admin"
                          className="flex items-center gap-2 text-rose-500 dark:text-rose-400"
                        >
                          <Shield className="h-4 w-4" />
                          Admin Panel
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => logout.mutate()}
                      className="text-geist-error dark:text-red-400"
                    >
                      <div className="flex items-center gap-2">
                        <LogOut className="h-4 w-4" />
                        Logout
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenu>
                </>
              ) : isStrictAuthPage || (!isReady && isAuthenticated) ? (
                /* Only show loading skeleton on strict auth pages or when actively authenticating */
                <div className="h-8 w-8 rounded-full bg-geist-canvas-soft-2 dark:bg-neutral-800 animate-pulse" />
              ) : (
                <Link href="/login">
                  <Button variant="nav-primary" size="nav">
                    Log In
                  </Button>
                </Link>
              )}

              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2 rounded-geist-sm text-geist-body hover:bg-geist-canvas-soft-2 transition-colors dark:text-white dark:hover:bg-neutral-800"
                aria-label="Toggle menu"
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile menu — full overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-x-0 top-16 z-40 bg-geist-canvas dark:bg-black border-b border-geist-hairline dark:border-neutral-800 geist-level-4 animate-slide-down">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-geist-sm text-body-sm transition-colors ${
                    isActive(link.href)
                      ? 'text-geist-ink bg-geist-canvas-soft-2 dark:text-white dark:bg-neutral-800'
                      : 'text-geist-body hover:text-geist-ink hover:bg-geist-canvas-soft dark:text-white dark:hover:text-white dark:hover:bg-neutral-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
            {user && (
              <>
                <div className="border-t border-geist-hairline dark:border-neutral-800 my-2" />
                <Link
                  href={`/profiles/${user.alias}`}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 rounded-geist-sm text-body-sm text-geist-body hover:text-geist-ink hover:bg-geist-canvas-soft dark:text-white dark:hover:text-white dark:hover:bg-neutral-900"
                >
                  <User className="h-4 w-4" />
                  My Profile
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 rounded-geist-sm text-body-sm text-geist-body hover:text-geist-ink hover:bg-geist-canvas-soft dark:text-white dark:hover:text-white dark:hover:bg-neutral-900"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
                {user.role === 'super_admin' && (
                  <Link
                    href="/admin"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-geist-sm text-body-sm text-rose-500 hover:bg-rose-50/60 dark:text-rose-400 dark:hover:bg-rose-900/20"
                  >
                    <Shield className="h-4 w-4" />
                    Admin Panel
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Overlay backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 top-16 z-30 bg-geist-ink/20 dark:bg-black/60"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  );
}
