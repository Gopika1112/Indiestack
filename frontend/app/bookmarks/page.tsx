"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { bookmarksAPI, postAPI, Bookmark, Post } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/components/toast-provider";
import { Bookmark as BookmarkIcon, Trash2, Loader2 } from "lucide-react";

interface SavedItem {
  bookmark: Bookmark;
  post?: Post;
}

export default function BookmarksPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const { toast } = useToast();
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    bookmarksAPI
      .list()
      .then(async (res) => {
        const bookmarks = res.data || [];
        // Fetch each post to get author username/slug for correct links.
        const withPosts = await Promise.all(
          bookmarks.map(async (b): Promise<SavedItem> => {
            try {
              const postRes = await postAPI.getById(b.post_id);
              return { bookmark: b, post: postRes.data };
            } catch {
              return { bookmark: b };
            }
          })
        );
        setItems(withPosts);
      })
      .catch((err) => {
        console.error("Failed to load bookmarks:", err);
        toast({ title: "Failed to load saved posts", variant: "error" });
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading]);

  const handleRemove = async (postId: string) => {
    setRemovingId(postId);
    try {
      await bookmarksAPI.remove(postId);
      setItems((prev) => prev.filter((i) => i.bookmark.post_id !== postId));
      toast({ title: "Removed from your reading list" });
    } catch (err) {
      console.error("Remove failed:", err);
      toast({ title: "Failed to remove bookmark", variant: "error" });
    } finally {
      setRemovingId(null);
    }
  };

  const postHref = (item: SavedItem) =>
    item.post
      ? `/@${item.post.author_username}/${item.post.slug}`
      : undefined;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="container mx-auto px-4 py-8 max-w-[780px] flex-1">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Reading list</h1>
          <p className="text-muted-foreground mt-1">
            Posts you saved to read later.
          </p>
        </div>

        {loading || authLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading saved posts...
          </div>
        ) : !isAuthenticated ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-4">Sign in to view your reading list.</p>
            <Link href="/login">
              <Button variant="outline" className="rounded-full">Sign in</Button>
            </Link>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <BookmarkIcon className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">
              No saved posts yet. Tap the bookmark icon on any story to save it here.
            </p>
            <Link href="/feed">
              <Button variant="outline" className="rounded-full">Browse stories</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const href = postHref(item);
              const title = item.post?.title || item.bookmark.title || "Untitled";
              return (
                <div
                  key={item.bookmark.post_id}
                  className="border rounded-lg p-5 hover:shadow-sm transition-shadow flex items-start justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    {href ? (
                      <Link href={href} className="font-semibold text-lg hover:underline line-clamp-2">
                        {title}
                      </Link>
                    ) : (
                      <span className="font-semibold text-lg line-clamp-2">{title}</span>
                    )}
                    {item.post?.excerpt && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {item.post.excerpt}
                      </p>
                    )}
                    {item.post && (
                      <p className="text-xs text-muted-foreground mt-2">
                        by {item.post.author_name}
                        {item.post.reading_time_minutes
                          ? ` · ${item.post.reading_time_minutes} min read`
                          : ""}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-destructive hover:text-destructive shrink-0"
                    onClick={() => handleRemove(item.bookmark.post_id)}
                    disabled={removingId === item.bookmark.post_id}
                  >
                    {removingId === item.bookmark.post_id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Remove
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
