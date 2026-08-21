"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { listsAPI, ReadingList, Post } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/components/toast-provider";
import { PostCard } from "@/components/feed/post-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { List, Lock, Globe, Trash2, Loader2 } from "lucide-react";

export default function ListDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { isAuthenticated, user } = useAuthStore();
  const { toast } = useToast();

  const [list, setList] = useState<ReadingList | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const load = async () => {
    setLoading(true);
    try {
      const [listRes, postsRes] = await Promise.all([
        listsAPI.get(id),
        listsAPI.items(id),
      ]);
      if (listRes.success && listRes.data) setList(listRes.data);
      if (postsRes.success && postsRes.data) setPosts(postsRes.data);
    } catch (err) {
      console.error("Failed to load list:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const isOwner = isAuthenticated && user?.id === list?.user_id;

  const removeItem = async (postId: string) => {
    setRemovingId(postId);
    try {
      await listsAPI.removeItem(id, postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      toast({ title: "Removed from list", variant: "success" });
    } catch (err) {
      console.error("Remove item failed:", err);
      toast({ title: "Couldn't remove item", variant: "error" });
    } finally {
      setRemovingId(null);
    }
  };

  const handleDeleteList = async () => {
    if (!window.confirm(`Delete "${list?.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await listsAPI.remove(id);
      toast({ title: "List deleted", variant: "success" });
      router.push("/lists");
    } catch (err) {
      console.error("Delete list failed:", err);
      toast({ title: "Couldn't delete list", variant: "error" });
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-8 max-w-[680px]">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-4 w-full mb-8" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </main>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">List not found</h1>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="container mx-auto px-4 py-8 max-w-[680px] flex-1">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center shrink-0">
            <List className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{list.name}</h1>
              {list.is_public ? (
                <Globe className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Lock className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            {list.description && (
              <p className="text-muted-foreground mt-1">{list.description}</p>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              {list.item_count} stories · by {list.owner_name}
            </p>
          </div>
          {isOwner && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteList}
              disabled={deleting}
              className="rounded-full text-destructive hover:text-destructive border-destructive/40 shrink-0"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete list
                </>
              )}
            </Button>
          )}
        </div>

        {/* Stories */}
        <h2 className="text-lg font-semibold mb-4">Stories</h2>
        {posts.length > 0 ? (
          <div className="space-y-4">
            {posts.map((post) => (
              <div key={post.id} className="relative border rounded-lg p-4 hover:shadow-sm transition-shadow">
                <PostCard post={post} />
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-3 right-3 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => removeItem(post.id)}
                    disabled={removingId === post.id}
                    title="Remove from list"
                  >
                    {removingId === post.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <List className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">No stories in this list yet.</p>
          </div>
        )}
      </main>
    </div>
  );
}
