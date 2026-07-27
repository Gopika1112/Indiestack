"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { postAPI } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/components/toast-provider";
import { Loader2, ArrowLeft, X, ImagePlus } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";

const TipTapEditor = dynamic(
  () => import("@/components/editor/tiptap-editor").then((m) => m.TipTapEditor),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[400px] flex items-center justify-center text-muted-foreground">
        Loading editor...
      </div>
    ),
  }
);

export default function WritePage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [isPremium, setIsPremium] = useState(false);
  const [showCoverInput, setShowCoverInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  if (!isAuthenticated) {
    if (typeof window !== "undefined") {
      router.push("/login");
    }
    return null;
  }

  const generateSlug = () =>
    title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const handleSave = async () => {
    if (!title.trim()) return;
    setLoading(true);
    setSaveStatus("saving");
    try {
      const response = await postAPI.create({
        title,
        content: JSON.parse(content || "{}") as Record<string, unknown>,
        excerpt,
        cover_image_url: coverImageUrl,
        is_premium: isPremium,
        slug: generateSlug(),
        status: "draft",
      });
      if (response.success) {
        setSaveStatus("saved");
        toast({ title: "Draft saved", variant: "success" });
      }
    } catch (error) {
      console.error("Failed to save:", error);
      toast({ title: "Failed to save draft", variant: "error" });
      setSaveStatus("idle");
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!title.trim()) return;
    setPublishing(true);
    try {
      const response = await postAPI.create({
        title,
        content: JSON.parse(content || "{}") as Record<string, unknown>,
        excerpt,
        cover_image_url: coverImageUrl,
        is_premium: isPremium,
        slug: generateSlug(),
        status: "published",
      });
      if (response.success && response.data) {
        toast({ title: "Story published!", variant: "success" });
        router.push(`/@${user?.username}/${response.data.slug}`);
      }
    } catch (error) {
      console.error("Failed to publish:", error);
      toast({ title: "Failed to publish", variant: "error" });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal top bar */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto flex h-14 items-center justify-between px-4 max-w-[780px]">
          <Link href="/feed" className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <span className="text-sm text-muted-foreground">
            {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : ""}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSave}
              disabled={loading || publishing || !title.trim()}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save draft"}
            </Button>
            <Button
              size="sm"
              className="rounded-full px-4"
              onClick={() => setShowPublishModal(true)}
              disabled={loading || publishing || !title.trim()}
            >
              Publish
            </Button>
          </div>
        </div>
      </header>

      {/* Editor area */}
      <main className="container mx-auto px-4 py-10 max-w-[680px]">
        {/* Cover image */}
        {!showCoverInput && !coverImageUrl && (
          <button
            onClick={() => setShowCoverInput(true)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ImagePlus className="h-4 w-4" />
            Add cover image
          </button>
        )}
        {(showCoverInput || coverImageUrl) && (
          <div className="mb-6 flex items-center gap-2">
            <Input
              placeholder="Paste cover image URL..."
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              className="flex-1"
            />
            <button
              onClick={() => { setCoverImageUrl(""); setShowCoverInput(false); }}
              className="p-2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Title */}
        <textarea
          placeholder="Title"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setSaveStatus("idle"); }}
          className="w-full text-4xl font-bold tracking-tight bg-transparent border-none outline-none resize-none placeholder:text-muted-foreground/40 mb-4"
          rows={1}
          style={{ minHeight: "auto", overflow: "hidden" }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = "auto";
            target.style.height = target.scrollHeight + "px";
          }}
        />

        {/* Editor */}
        <div className="min-h-[400px]">
          <TipTapEditor
            content={content}
            onChange={(val) => { setContent(val); setSaveStatus("idle"); }}
            placeholder="Tell your story..."
          />
        </div>
      </main>

      {/* Publish Modal */}
      <Dialog.Root open={showPublishModal} onOpenChange={setShowPublishModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-background rounded-xl border shadow-2xl p-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
            <Dialog.Title className="text-lg font-semibold mb-1">
              Publish your story
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground mb-6">
              Review and finalize before publishing.
            </Dialog.Description>

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
                <label className="text-sm font-medium mb-1.5 block">Cover image URL</label>
                <Input
                  placeholder="https://..."
                  value={coverImageUrl}
                  onChange={(e) => setCoverImageUrl(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
                <input
                  type="checkbox"
                  id="premium-modal"
                  checked={isPremium}
                  onChange={(e) => setIsPremium(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="premium-modal" className="text-sm font-medium">
                  Members only
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Dialog.Close asChild>
                <Button variant="ghost">Cancel</Button>
              </Dialog.Close>
              <Button
                onClick={handlePublish}
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
