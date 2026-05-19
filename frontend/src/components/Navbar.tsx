"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentUser, useLogout } from "@/hooks/useAuth";
import { NotificationBell } from "@/features/forum/NotificationBell";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  LogOut,
  Settings,
  User,
  Menu,
  X,
  Home,
  FolderGit2,
  Users,
  Code2,
} from "lucide-react";

const NAV_LINKS = [
  { href: "/", label: "Feed", icon: Home },
  { href: "/showcase", label: "Showcase", icon: FolderGit2, auth: true },
  { href: "/members", label: "Members", icon: Users, auth: true },
];

export function Navbar() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-millennium-border bg-white">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-10">
              <Link href="/" className="flex items-center gap-3 group">
                <div className="h-8 w-8 bg-millennium-cyan flex items-center justify-center">
                  <Code2 className="h-4 w-4 text-white" strokeWidth={2.5} />
                </div>
                <span className="text-base font-black text-millennium-black tracking-tight hidden sm:inline">
                  SWU OSR
                </span>
              </Link>

              {/* Desktop Navigation */}
              <div className="hidden md:flex items-center gap-1">
                {NAV_LINKS.map((link) => {
                  if (link.auth && !user) return null;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                        isActive(link.href)
                          ? "text-millennium-cyan"
                          : "text-millennium-slate hover:text-millennium-black"
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <NotificationBell />
                  <DropdownMenu
                    trigger={
                      <div className="flex items-center gap-2 cursor-pointer p-1 hover:opacity-70 transition-opacity">
                        <Avatar
                          src={user.avatar_url}
                          alt={user.alias}
                          fallback={user.alias.charAt(0).toUpperCase()}
                          size="sm"
                        />
                      </div>
                    }
                  >
                    <div className="px-3 py-2 border-b border-millennium-border max-w-[200px]">
                      <p className="text-sm font-extrabold text-millennium-black break-words">
                        {user.alias}
                      </p>
                      <p className="text-xs text-millennium-slate-mid">{user.nim}</p>
                    </div>
                    <DropdownMenuItem>
                      <Link
                        href={`/profiles/${user.alias}`}
                        className="flex items-center gap-2"
                      >
                        <User className="h-4 w-4" />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Link
                        href="/settings"
                        className="flex items-center gap-2"
                      >
                        <Settings className="h-4 w-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => logout.mutate()}
                      className="text-red-600"
                    >
                      <div className="flex items-center gap-2">
                        <LogOut className="h-4 w-4" />
                        Logout
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenu>
                </>
              ) : (
                <Link href="/login">
                  <Button size="sm">
                    Sign In
                  </Button>
                </Link>
              )}

              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2 text-millennium-black hover:text-millennium-cyan transition-colors"
                aria-label="Toggle menu"
              >
                {mobileOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile slide-down menu */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-x-0 top-16 z-40 bg-white border-b border-millennium-border">
          <div className="px-6 py-4 space-y-1">
            {NAV_LINKS.map((link) => {
              if (link.auth && !user) return null;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-4 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${
                    isActive(link.href)
                      ? "text-millennium-cyan"
                      : "text-millennium-slate hover:text-millennium-black"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            {user && (
              <>
                <div className="border-t border-millennium-border my-2" />
                <Link
                  href={`/profiles/${user.alias}`}
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 text-sm font-bold uppercase tracking-wider text-millennium-slate hover:text-millennium-black"
                >
                  Profile
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 text-sm font-bold uppercase tracking-wider text-millennium-slate hover:text-millennium-black"
                >
                  Settings
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      {/* Overlay for mobile menu */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 top-16 z-30 bg-black/10"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  );
}
