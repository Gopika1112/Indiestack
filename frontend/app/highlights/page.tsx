"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { highlightsAPI, PostHighlight } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/components/toast-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeDate } from "@/lib/utils";
import { Highlighter, Trash2, Loader2 } from "lucide-react";

const COLOR_BG: Record<string, string> = {
  yellow: "#fef08a",
  green: "#bbf7d0",
  blue: "#bfdbfe",
  pink: "#fbcfe8",
};

export default function HighlightsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const { toast } = useToast();
  const [highlights, setHighlights] = useState<PostHighlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    highlightsAPI
      .list()
      .then((res) => setHighlights(res.data || []))
      .catch(() => setHighlights([]))
      .finally(() => setLoading(false));
  }, [isAuthenticated, authLoading]);

  const remove = async (h: PostHighlight) => {
    setBusyId(h.id);
    try {
      await highlightsAPI.remove(h.id);
      setHighlights((prev) => prev.filter((x) => x.id !== h.id));
      toast({ title: "Highlight removed", variant: "success" });
    } catch {
      toast({ title: "Couldn't remove highlight", variant: "error" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 max-w-[680px]">
        <h1 className="text-3xl font-bold mb-2">Your highlights</h1>
        <p className="text-muted-foreground mb-8">Passages you&apos;ve saved while reading.</p>

        {loading || authLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : !isAuthenticated ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-4">Sign in to see your highlights.</p>
            <Link href="/login">
              <Button variant="outline" className="rounded-full">Sign in</Button>
            </Link>
          </div>
        ) : highlights.length === 0 ? (
          <div className="text-center py-16">
            <Highlighter className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground mb-2">No highlights yet.</p>
            <p className="text-sm text-muted-foreground">Select text while reading a story to save it here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {highlights.map((h) => (
              <div key={h.id} className="border rounded-lg p-5">
                <blockquote
                  className="border-l-4 pl-4 py-1 mb-3 italic text-foreground"
                  style={{ borderColor: COLOR_BG[h.color] || COLOR_BG.yellow }}
                >
                  &ldquo;{h.text}&rdquo;
                </blockquote>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 text-sm">
                    <Link
                      href={`/@${h.author_username}/${h.post_slug}`}
                      className="font-medium hover:underline line-clamp-1"
                    >
                      {h.post_title}
                    </Link>
                    <span className="text-muted-foreground"> · {formatRelativeDate(h.created_at)}</span>
                  </div>
                  <button
                    onClick={() => remove(h)}
                    disabled={busyId === h.id}
                    title="Remove highlight"
                    className="p-1.5 text-muted-foreground hover:text-destructive shrink-0"
                  >
                    {busyId === h.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
