'use client';

import { useCurrentUser, useLogout } from '@/hooks/useAuth';
import { ProfileEditForm } from '@/features/profile/ProfileEditForm';
import { SkillManager } from '@/features/profile/SkillManager';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, CheckCircle, Settings, Github, GraduationCap, LogOut } from 'lucide-react';

export default function SettingsPage() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gray-100 dark:bg-neutral-800 flex items-center justify-center">
          <Settings className="h-5 w-5 text-gray-600 dark:text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-sm text-gray-500 dark:text-white">
            Manage your profile and account preferences.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Profile section */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-white uppercase tracking-wider mb-3">
            Profile
          </h2>
          <ProfileEditForm />
        </section>

        {/* Skills section */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-white uppercase tracking-wider mb-3">
            Skills
          </h2>
          <SkillManager />
        </section>

        {/* GitHub connection */}
        {user && user.github_username && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-white uppercase tracking-wider mb-3">
              GitHub Connection
            </h2>
            <Card className="hover:border-green-200 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-green-50 dark:bg-neutral-800 flex items-center justify-center">
                    <Github className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        Connected
                      </span>
                    </div>
                    <a
                      href={`https://github.com/${user.github_username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary-600 dark:text-white hover:underline flex items-center gap-1 mt-0.5"
                    >
                      @{user.github_username}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Academic Identity */}
        {user && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-white uppercase tracking-wider mb-3">
              Linked Identity
            </h2>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary-50 dark:bg-neutral-800 flex items-center justify-center">
                    <GraduationCap className="h-4 w-4 text-primary-600 dark:text-white" />
                  </div>
                  <div>
                    <span className="text-sm text-gray-700 dark:text-white">Student ID</span>
                    <div className="mt-0.5">
                      <Badge
                        variant="secondary"
                        className="bg-primary-50 text-primary-700 dark:bg-neutral-800 dark:text-white"
                      >
                        {user.nim}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Danger zone */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-white uppercase tracking-wider mb-3">
            Account
          </h2>
          <Card className="border-red-100">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Sign out of your account
                </p>
                <p className="text-xs text-gray-500 dark:text-white mt-0.5">
                  You&apos;ll need to re-authenticate to access your account.
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
                className="gap-1.5"
              >
                <LogOut className="h-3.5 w-3.5" />
                {logout.isPending ? '...' : 'Logout'}
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
