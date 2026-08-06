"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { feedAPI, topicsAPI, TagCount } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/components/toast-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Flame, Plus, Check } from "lucide-react";

// TrendingTopicsRail shows the hottest topics (tags) with follow/unfollow buttons.
export function TrendingTopicsRail() {
  const { isAuthenticated } = useAuthStore();
  const { toast } = useToast();
  const [topics, setTopics] = useState<TagCount[]>([]);
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await feedAPI.getTrendingTopics();
        if (!cancelled) setTopics(res.data || []);
      } catch {
        if (!cancelled) setTopics([]);
      }
      if (isAuthenticated) {
        try {
          const f = await topicsAPI.listFollowed();
          if (!cancelled) setFollowed(new Set(f.data || []));
        } catch {
          /* not critical */
        }
      }
      if (!cancelled) setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const toggle = async (tag: string) => {
    if (!isAuthenticated) {
      toast({ title: "Sign in to follow topics", variant: "error" });
      return;
    }
    setBusy(tag);
    const isFollowing = followed.has(tag);
    try {
      if (isFollowing) {
        await topicsAPI.unfollow(tag);
        setFollowed((s) => {
          const next = new Set(s);
          next.delete(tag);
          return next;
        });
        toast({ title: `Unfollowed ${tag}` });
      } else {
        await topicsAPI.follow(tag);
        setFollowed((s) => new Set(s).add(tag));
        toast({ title: `Following ${tag}`, variant: "success" });
      }
    } catch {
      toast({ title: "Couldn't update topic", variant: "error" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Flame className="h-4 w-4 text-orange-500" />
        <h3 className="text-sm font-bold">Trending topics</h3>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-full" />
          ))}
        </div>
      ) : topics.length === 0 ? (
        <p className="text-xs text-muted-foreground">No trending topics yet.</p>
      ) : (
        <ul className="space-y-1">
          {topics.map((t) => {
            const isFollowing = followed.has(t.tag);
            return (
              <li key={t.tag} className="flex items-center justify-between gap-2 py-1.5">
                <Link
                  href={`/discover?tag=${encodeURIComponent(t.tag)}`}
                  className="text-sm font-medium hover:underline truncate"
                >
                  #{t.tag}
                </Link>
                <Button
                  variant={isFollowing ? "secondary" : "outline"}
                  size="sm"
                  disabled={busy === t.tag}
                  onClick={() => toggle(t.tag)}
                  className="h-7 rounded-full px-3 text-xs shrink-0"
                >
                  {isFollowing ? (
                    <>
                      <Check className="mr-1 h-3 w-3" /> Following
                    </>
                  ) : (
                    <>
                      <Plus className="mr-1 h-3 w-3" /> Follow
                    </>
                  )}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
