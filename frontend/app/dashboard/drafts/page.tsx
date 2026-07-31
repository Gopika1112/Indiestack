"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { postAPI, Post } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/components/toast-provider";
import { formatDate } from "@/lib/utils";
import { FileText, PenLine, Trash2, Send, Loader2 } from "lucide-react";

export default function DraftsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    postAPI
      .getMyPosts()
      .then((res) => {
        const all = res.data || [];
        setDrafts(all.filter((p) => p.status === "draft"));
      })
      .catch((err) => {
        console.error("Failed to load drafts:", err);
        toast({ title: "Failed to load drafts", variant: "error" });
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading]);

  const handlePublish = async (post: Post) => {
    setActionId(post.id);
    try {
      await postAPI.update(post.id, { status: "published" });
      setDrafts((prev) => prev.filter((d) => d.id !== post.id));
      toast({ title: `"${post.title}" published`, variant: "success" });
    } catch (err) {
      console.error("Publish failed:", err);
      toast({ title: "Failed to publish draft", variant: "error" });
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (post: Post) => {
    if (!window.confirm(`Delete draft "${post.title}"? This cannot be undone.`)) return;
    setActionId(post.id);
    try {
      await postAPI.delete(post.id);
      setDrafts((prev) => prev.filter((d) => d.id !== post.id));
      toast({ title: "Draft deleted", variant: "success" });
    } catch (err) {
      console.error("Delete failed:", err);
      toast({ title: "Failed to delete draft", variant: "error" });
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-[780px] flex-1">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Drafts</h1>
            <p className="text-muted-foreground mt-1">
              Your unpublished stories.
            </p>
          </div>
          <Link href="/write">
            <Button className="rounded-full gap-2">
              <PenLine className="h-4 w-4" />
              New story
            </Button>
          </Link>
        </div>

        {loading || authLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading drafts...
          </div>
        ) : !isAuthenticated ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-4">Sign in to view your drafts.</p>
            <Link href="/login">
              <Button variant="outline" className="rounded-full">Sign in</Button>
            </Link>
          </div>
        ) : drafts.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">No drafts yet.</p>
            <Link href="/write">
              <Button variant="outline" className="rounded-full">
                Start writing
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {drafts.map((draft) => (
              <div
                key={draft.id}
                className="border rounded-lg p-5 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/write?draft=${draft.id}`}
                      className="font-semibold text-lg hover:underline line-clamp-1"
                    >
                      {draft.title || "Untitled"}
                    </Link>
                    {draft.excerpt && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {draft.excerpt}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Last edited {formatDate(draft.updated_at || draft.created_at)}
                      {draft.reading_time_minutes
                        ? ` · ${draft.reading_time_minutes} min read`
                        : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4">
                  <Link href={`/write?draft=${draft.id}`}>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <PenLine className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => handlePublish(draft)}
                    disabled={actionId === draft.id}
                  >
                    {actionId === draft.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    Publish
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(draft)}
                    disabled={actionId === draft.id}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
