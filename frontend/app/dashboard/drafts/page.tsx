"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { postAPI, uploadAPI, Post } from "@/lib/api";
import { TagPicker } from "@/components/editor/tag-picker";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/components/toast-provider";
import { formatDate } from "@/lib/utils";
import * as Dialog from "@radix-ui/react-dialog";
import { FileText, PenLine, Trash2, Send, Loader2, Upload } from "lucide-react";

export default function DraftsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  // Publish-modal state for the draft currently being published.
  const [publishTarget, setPublishTarget] = useState<Post | null>(null);
  const [excerpt, setExcerpt] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [isPremium, setIsPremium] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const coverFileInputRef = useRef<HTMLInputElement>(null);

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

  // Open the publish modal pre-filled with the draft's current metadata so the
  // author can add a description/tags/cover before the post goes live.
  const openPublishModal = (post: Post) => {
    setPublishTarget(post);
    setExcerpt(post.excerpt || "");
    setTags(post.tags || []);
    setCoverImageUrl(post.cover_image_url || "");
    setIsPremium(!!post.is_premium);
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverUploading(true);
    try {
      const result = await uploadAPI.upload(file);
      setCoverImageUrl(result.url);
      toast({ title: "Cover image uploaded", variant: "success" });
    } catch (err) {
      console.error("Cover upload failed:", err);
      toast({
        title: err instanceof Error ? `Cover upload failed: ${err.message}` : "Cover upload failed",
        variant: "error",
      });
    } finally {
      setCoverUploading(false);
      if (coverFileInputRef.current) coverFileInputRef.current.value = "";
    }
  };

  const handleConfirmPublish = async () => {
    if (!publishTarget) return;
    setPublishing(true);
    try {
      await postAPI.update(publishTarget.id, {
        excerpt,
        tags,
        cover_image_url: coverImageUrl,
        is_premium: isPremium,
        status: "published",
      });
      setDrafts((prev) => prev.filter((d) => d.id !== publishTarget.id));
      setPublishTarget(null);
      toast({ title: `"${publishTarget.title}" published`, variant: "success" });
    } catch (err) {
      console.error("Publish failed:", err);
      toast({ title: "Failed to publish draft", variant: "error" });
    } finally {
      setPublishing(false);
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
                    onClick={() => openPublishModal(draft)}
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

      {/* Publish modal — collect description/tags/cover before going live */}
      <Dialog.Root open={!!publishTarget} onOpenChange={(open) => !open && setPublishTarget(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-background rounded-xl border shadow-2xl p-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
            <Dialog.Title className="text-lg font-semibold mb-1">
              Publish your story
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground mb-6">
              Add a description and topics before publishing &ldquo;{publishTarget?.title}&rdquo;.
            </Dialog.Description>

            {/* Hidden file input for cover upload */}
            <input
              ref={coverFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
              className="hidden"
              onChange={handleCoverUpload}
            />

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Excerpt</label>
                <Textarea
                  placeholder="Write a brief summary of your story..."
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  className="resize-none"
                  rows={3}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Tags</label>
                <TagPicker value={tags} onChange={setTags} max={5} placeholder="Add a topic (e.g. Technology, AI)..." />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Cover image</label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => coverFileInputRef.current?.click()}
                    disabled={coverUploading}
                  >
                    {coverUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <><Upload className="mr-1.5 h-4 w-4" />{coverImageUrl ? "Replace" : "Upload"}</>
                    )}
                  </Button>
                  {coverImageUrl && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setCoverImageUrl("")}>
                      Remove
                    </Button>
                  )}
                </div>
                {coverImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverImageUrl}
                    alt="Cover preview"
                    className="mt-2 max-h-40 rounded-lg border object-cover"
                  />
                )}
              </div>

              <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
                <input
                  type="checkbox"
                  id="draft-premium-modal"
                  checked={isPremium}
                  onChange={(e) => setIsPremium(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="draft-premium-modal" className="text-sm font-medium">
                  Members only
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Dialog.Close asChild>
                <Button variant="ghost">Cancel</Button>
              </Dialog.Close>
              <Button
                onClick={handleConfirmPublish}
                disabled={publishing}
                className="rounded-full px-6"
              >
                {publishing ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Publishing...</>
                ) : (
                  "Publish now"
                )}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
