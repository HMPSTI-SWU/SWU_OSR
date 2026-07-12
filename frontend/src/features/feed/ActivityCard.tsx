import Link from 'next/link';
import type { ActivityItem } from '@/types/activity';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  GitBranch,
  GitPullRequest,
  Tag,
  GitCommit,
  GitFork,
  Star,
  CircleDot,
  Plus,
} from 'lucide-react';

interface ActivityCardProps {
  item: ActivityItem;
}

function getEventConfig(eventType: string, summary: string) {
  if (summary.startsWith('Forked')) {
    return {
      icon: GitFork,
      label: 'forked',
      iconColor: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-50 dark:bg-orange-950/40',
    };
  }
  if (summary.startsWith('Starred')) {
    return {
      icon: Star,
      label: 'starred',
      iconColor: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-50 dark:bg-yellow-950/40',
    };
  }
  if (summary.startsWith('Created repository')) {
    return {
      icon: Plus,
      label: 'created',
      iconColor: 'text-teal-600 dark:text-teal-400',
      bgColor: 'bg-teal-50 dark:bg-teal-950/40',
    };
  }
  if (summary.startsWith('Created branch') || summary.startsWith('Created tag')) {
    return {
      icon: GitBranch,
      label: 'created',
      iconColor: 'text-cyan-600 dark:text-cyan-400',
      bgColor: 'bg-cyan-50 dark:bg-cyan-950/40',
    };
  }
  if (summary.startsWith('Issue')) {
    return {
      icon: CircleDot,
      label: 'issue on',
      iconColor: 'text-rose-600 dark:text-rose-400',
      bgColor: 'bg-rose-50 dark:bg-rose-950/40',
    };
  }

  switch (eventType) {
    case 'push':
      return {
        icon: GitCommit,
        label: 'pushed to',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
        bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
      };
    case 'pull_request':
      return {
        icon: GitPullRequest,
        label: 'PR on',
        iconColor: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-50 dark:bg-purple-950/40',
      };
    case 'release':
      return {
        icon: Tag,
        label: 'released',
        iconColor: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-50 dark:bg-blue-950/40',
      };
    default:
      return {
        icon: GitBranch,
        label: 'updated',
        iconColor: 'text-gray-600 dark:text-gray-400',
        bgColor: 'bg-gray-50 dark:bg-neutral-800/60',
      };
  }
}

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (weeks > 0) return `${weeks}w ago`;
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

function getRepoShortName(repoName: string): string {
  if (repoName.includes('/')) {
    return repoName.split('/').pop() || repoName;
  }
  return repoName;
}

export function ActivityCard({ item }: ActivityCardProps) {
  const config = getEventConfig(item.event_type, item.summary);
  const Icon = config.icon;
  const repoShort = getRepoShortName(item.repo_name);

  return (
    <Card className="transition-shadow hover:shadow-geist-3">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Event icon — color-coded background per event type */}
          <div
            className={`h-8 w-8 rounded-geist-sm ${config.bgColor} flex items-center justify-center shrink-0`}
          >
            <Icon className={`h-4 w-4 ${config.iconColor}`} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/profiles/${item.user_alias}`}
                className="text-body-sm-strong text-geist-ink dark:text-gray-100 hover:text-geist-link dark:hover:text-primary-400 transition-colors"
              >
                {item.user_alias}
              </Link>
              <span className={`text-caption font-medium ${config.iconColor}`}>{config.label}</span>
              {item.repo_id ? (
                <Link href={`/repos/${item.repo_id}`}>
                  <Badge
                    variant="secondary"
                    className="text-[10px] cursor-pointer hover:bg-geist-canvas-soft-2 dark:hover:bg-neutral-700 transition-colors"
                  >
                    {repoShort}
                  </Badge>
                </Link>
              ) : (
                <a
                  href={`https://github.com/${item.repo_full_name || item.repo_name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Badge
                    variant="secondary"
                    className="text-[10px] cursor-pointer hover:bg-geist-canvas-soft-2 dark:hover:bg-neutral-700 transition-colors"
                  >
                    {repoShort}
                  </Badge>
                </a>
              )}
            </div>
            <p className="text-body-sm text-geist-body dark:text-gray-300 mt-1 line-clamp-2">
              {item.summary}
            </p>
          </div>

          {/* Timestamp — mono caption */}
          <span className="text-caption-mono text-geist-mute dark:text-gray-500 shrink-0 pt-0.5">
            {getRelativeTime(item.created_at)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
