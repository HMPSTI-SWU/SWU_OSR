"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { FeedResponse } from "@/types/activity";
import { useCurrentUser } from "@/hooks/useAuth";
import { ActivityCard } from "./ActivityCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { FolderGit2, RefreshCw, Inbox, Zap } from "lucide-react";

export function ActivityFeed() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useInfiniteQuery<FeedResponse>({
    queryKey: ["activityFeed"],
    queryFn: async ({ pageParam }) => {
      const params = pageParam
        ? { cursor: pageParam, limit: 20 }
        : { limit: 20 };
      const { data } = await api.get<{ ok: boolean; data: FeedResponse }>(
        "/feed",
        { params }
      );
      return data.data;
    },
    initialPageParam: "",
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? lastPage.next_cursor : undefined,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ ok: boolean; data: { synced: number } }>(
        "/activity/sync"
      );
      return data.data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["activityFeed"] });
      if (result.synced > 0) {
        toast(`Synced ${result.synced} new activities from GitHub`, "success");
      } else {
        toast("Already up to date — no new activities found", "success");
      }
    },
    onError: () => {
      toast("Failed to sync activity from GitHub", "error");
    },
  });

  const autoSyncRef = useRef(false);
  useEffect(() => {
    if (autoSyncRef.current) return;
    if (isLoading || isError) return;
    const items = data?.pages.flatMap((page) => page.items) ?? [];
    if (items.length === 0 && user && !syncMutation.isPending) {
      autoSyncRef.current = true;
      syncMutation.mutate();
    }
  }, [data, user, isLoading, isError]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="border border-red-600 p-8 text-left">
        <p className="text-sm font-bold text-red-600 uppercase tracking-wider mb-3">
          Error Loading Feed
        </p>
        <p className="text-sm text-millennium-slate mb-4">
          Failed to load activity feed.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Try Again
        </Button>
      </div>
    );
  }

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  if (items.length === 0) {
    return (
      <div className="border-2 border-dashed border-millennium-border p-10 text-left">
        <div className="h-12 w-12 bg-millennium-off-white flex items-center justify-center mb-4">
          <Inbox className="h-6 w-6 text-millennium-slate-mid" />
        </div>
        <h3 className="text-base font-extrabold text-millennium-black mb-1">
          No activity yet
        </h3>
        <p className="text-sm text-millennium-slate max-w-sm mb-6">
          {user
            ? "Sync your GitHub activity or add repos to your showcase to start tracking contributions."
            : "Sign in and add repos to your showcase to start tracking open source contributions."}
        </p>
        <div className="flex items-center gap-3">
          {user && (
            <Button
              variant="default"
              size="sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              {syncMutation.isPending ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin mr-2" />
              ) : (
                <Zap className="h-3.5 w-3.5 mr-2" />
              )}
              {syncMutation.isPending ? "Syncing..." : "Sync GitHub"}
            </Button>
          )}
          <Link href={user ? "/showcase" : "/login"}>
            <Button variant="outline" size="sm">
              <FolderGit2 className="h-3.5 w-3.5 mr-2" />
              {user ? "Showcase" : "Sign In"}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Sync control */}
      {user && (
        <div className="flex justify-end mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-2" />
            )}
            {syncMutation.isPending ? "Syncing..." : "Sync"}
          </Button>
        </div>
      )}

      {/* Activity list — no cards, just clean dividers */}
      <div className="border-t border-millennium-border">
        {items.map((item) => (
          <ActivityCard key={item.id} item={item} />
        ))}
      </div>

      {hasNextPage && (
        <div className="pt-6">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin mr-2" />
                Loading...
              </>
            ) : (
              "Load More"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
