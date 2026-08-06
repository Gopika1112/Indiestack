"use client";

import { useEffect, useState } from "react";
import { topicsAPI } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/components/toast-provider";
import { Plus, Check } from "lucide-react";

// TopicFollowButton toggles following a topic tag. Compact pill style.
export function TopicFollowButton({ tag }: { tag: string }) {
  const { isAuthenticated } = useAuthStore();
  const { toast } = useToast();
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    topicsAPI
      .listFollowed()
      .then((res) => setFollowing((res.data || []).includes(tag)))
      .catch(() => {});
  }, [isAuthenticated, tag]);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      toast({ title: "Sign in to follow topics", variant: "error" });
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      if (following) {
        await topicsAPI.unfollow(tag);
        setFollowing(false);
        toast({ title: `Unfollowed ${tag}` });
      } else {
        await topicsAPI.follow(tag);
        setFollowing(true);
        toast({ title: `Following ${tag}`, variant: "success" });
      }
    } catch {
      toast({ title: "Couldn't update topic", variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      title={following ? `Unfollow ${tag}` : `Follow ${tag}`}
      className={`inline-flex items-center justify-center h-5 w-5 rounded-full border transition-colors ${
        following
          ? "bg-foreground text-background border-foreground"
          : "text-muted-foreground border-border hover:text-foreground"
      } ${busy ? "opacity-50" : ""}`}
    >
      {following ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
    </button>
  );
}
