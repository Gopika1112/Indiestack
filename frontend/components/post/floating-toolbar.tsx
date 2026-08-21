"use client";

import { useEffect, useState } from "react";
import { bookmarksAPI } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/components/toast-provider";
import { Heart, MessageCircle, Bookmark, Share2, LinkIcon } from "lucide-react";

interface FloatingToolbarProps {
  postId: string;
  likeCount: number;
  commentCount: number;
}

export function FloatingToolbar({ postId, likeCount, commentCount }: FloatingToolbarProps) {
  const { isAuthenticated } = useAuthStore();
  const { toast } = useToast();
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  };

  const toggleBookmark = async () => {
    if (!isAuthenticated) {
      toast({ title: "Sign in to save posts", variant: "error" });
      return;
    }
    if (saving) return;

    const next = !saved;
    setSaved(next);
    setSaving(true);
    try {
      if (next) {
        await bookmarksAPI.add(postId);
        toast({ title: "Saved to your reading list", variant: "success" });
      } else {
        await bookmarksAPI.remove(postId);
        toast({ title: "Removed from your reading list" });
      }
    } catch (err) {
      console.error("Bookmark toggle failed:", err);
      setSaved(!next);
      toast({ title: "Couldn't update bookmark", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div className="flex items-center gap-1 px-4 py-2 rounded-full border bg-background/95 backdrop-blur shadow-lg">
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-muted-foreground hover:text-red-500 transition-colors rounded-full hover:bg-muted">
          <Heart className="h-5 w-5" />
          <span className="text-sm">{likeCount}</span>
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted">
          <MessageCircle className="h-5 w-5" />
          <span className="text-sm">{commentCount}</span>
        </button>
        <div className="w-px h-5 bg-border mx-1" />
        <button
          onClick={toggleBookmark}
          disabled={saving}
          title={saved ? "Remove from reading list" : "Save to reading list"}
          className={`p-2 transition-colors rounded-full hover:bg-muted ${saved ? "text-primary" : "text-muted-foreground hover:text-foreground"
            } ${saving ? "opacity-50" : ""}`}
        >
          <Bookmark className={`h-5 w-5 ${saved ? "fill-current" : ""}`} />
        </button>
        <button
          onClick={handleCopyLink}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted"
          title={copied ? "Copied!" : "Copy link"}
        >
          {copied ? <LinkIcon className="h-5 w-5 text-green-500" /> : <Share2 className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
