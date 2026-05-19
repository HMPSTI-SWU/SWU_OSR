import Link from "next/link";
import type { ActivityItem } from "@/types/activity";
import { Badge } from "@/components/ui/badge";
import {
  GitBranch,
  GitPullRequest,
  Tag,
  GitCommit,
  GitFork,
  Star,
  CircleDot,
  Plus,
} from "lucide-react";

interface ActivityCardProps {
  item: ActivityItem;
}

function getEventConfig(eventType: string, summary: string) {
  if (summary.startsWith("Forked")) {
    return { icon: GitFork, label: "FORKED" };
  }
  if (summary.startsWith("Starred")) {
    return { icon: Star, label: "STARRED" };
  }
  if (summary.startsWith("Created repository")) {
    return { icon: Plus, label: "CREATED" };
  }
  if (summary.startsWith("Created branch") || summary.startsWith("Created tag")) {
    return { icon: GitBranch, label: "CREATED" };
  }
  if (summary.startsWith("Issue")) {
    return { icon: CircleDot, label: "ISSUE" };
  }

  switch (eventType) {
    case "push":
      return { icon: GitCommit, label: "PUSHED" };
    case "pull_request":
      return { icon: GitPullRequest, label: "PR" };
    case "release":
      return { icon: Tag, label: "RELEASE" };
    default:
      return { icon: GitBranch, label: "UPDATE" };
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
  return "just now";
}

function getRepoShortName(repoName: string): string {
  if (repoName.includes("/")) {
    return repoName.split("/").pop() || repoName;
  }
  return repoName;
}

export function ActivityCard({ item }: ActivityCardProps) {
  const config = getEventConfig(item.event_type, item.summary);
  const Icon = config.icon;
  const repoShort = getRepoShortName(item.repo_name);

  return (
    <div className="border-b border-millennium-border py-5 last:border-b-0">
      <div className="flex items-start gap-4">
        {/* Event icon — stark cyan square */}
        <div className="h-10 w-10 bg-millennium-cyan flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-white" strokeWidth={2.5} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Primary line: action + repo (visually dominant) */}
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-black text-millennium-black uppercase tracking-wide">
              {config.label}
            </span>
            <Link
              href={`/repos/${item.repo_name}`}
              className="text-sm font-extrabold text-millennium-black hover:text-millennium-cyan transition-colors"
            >
              {repoShort}
            </Link>
            <span className="text-sm text-millennium-slate-mid">
              by
            </span>
            <Link
              href={`/profiles/${item.user_alias}`}
              className="text-sm font-normal text-millennium-slate hover:text-millennium-cyan transition-colors"
            >
              {item.user_alias}
            </Link>
          </div>

          {/* Summary text */}
          <p className="text-sm text-millennium-slate mt-1 line-clamp-2">
            {item.summary}
          </p>
        </div>

        {/* Timestamp — flush right */}
        <span className="text-xs font-medium text-millennium-slate-mid shrink-0 tabular-nums">
          {getRelativeTime(item.created_at)}
        </span>
      </div>
    </div>
  );
}
