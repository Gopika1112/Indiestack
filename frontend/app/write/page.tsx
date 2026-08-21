"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { postAPI, uploadAPI } from "@/lib/api";
import { TagPicker } from "@/components/editor/tag-picker";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/components/toast-provider";
import { Loader2, ArrowLeft, X, ImagePlus, Upload, Eye } from "lucide-react";
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

function WritePageEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [draftId, setDraftId] = useState<string | null>(searchParams.get("draft"));
  const { isAuthenticated, user } = useAuthStore();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [coverUploading, setCoverUploading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(!!draftId);
  const [existingSlug, setExistingSlug] = useState("");
  const [existingStatus, setExistingStatus] = useState<"draft" | "published" | "archived" | "">("");
  const coverFileInputRef = useRef<HTMLInputElement>(null);

  // Load an existing draft when ?draft=<id> is present.
  useEffect(() => {
    if (!draftId) return;
    postAPI
      .getById(draftId)
      .then((res) => {
        const p = res.data;
        if (p) {
          setTitle(p.title || "");
          setExcerpt(p.excerpt || "");
          setTags(p.tags || []);
          setCoverImageUrl(p.cover_image_url || "");
          setIsPremium(!!p.is_premium);
          setExistingSlug(p.slug || "");
          setExistingStatus(p.status || "");
          if (p.content) setContent(JSON.stringify(p.content));
        }
      })
      .catch((err) => {
        console.error("Failed to load draft:", err);
        toast({ title: "Failed to load draft", variant: "error" });
      })
      .finally(() => setDraftLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId]);

  if (!isAuthenticated) {
    if (typeof window !== "undefined") {
      router.push("/login");
    }
    return null;
  }

  if (draftLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading draft...
      </div>
    );
  }

  const generateSlug = () =>
    title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCoverUploading(true);
    try {
      const result = await uploadAPI.upload(file);
      setCoverImageUrl(result.url);
      toast({ title: "Cover image uploaded", variant: "success" });
    } catch (error) {
      console.error("Cover upload failed:", error);
      toast({
        title: error instanceof Error ? `Cover upload failed: ${error.message}` : "Cover upload failed",
        variant: "error",
      });
    } finally {
      setCoverUploading(false);
      if (coverFileInputRef.current) {
        coverFileInputRef.current.value = "";
      }
    }
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setLoading(true);
    setSaveStatus("saving");
    try {
      if (draftId) {
        // Update the existing draft in place.
        await postAPI.update(draftId, {
          title,
          content: JSON.parse(content || "{}") as Record<string, unknown>,
          excerpt,
          tags,
          cover_image_url: coverImageUrl,
          is_premium: isPremium,
          status: "draft",
        });
        setSaveStatus("saved");
        toast({ title: "Draft saved", variant: "success" });
      } else {
        const response = await postAPI.create({
          title,
          content: JSON.parse(content || "{}") as Record<string, unknown>,
          excerpt,
          tags,
          cover_image_url: coverImageUrl,
          is_premium: isPremium,
          slug: generateSlug(),
          status: "draft",
        });
        if (response.success) {
          setDraftId(response.data?.id ?? null);
          setSaveStatus("saved");
          toast({ title: "Draft saved", variant: "success" });
        }
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
      const payload = {
        title,
        content: JSON.parse(content || "{}") as Record<string, unknown>,
        excerpt,
        tags,
        cover_image_url: coverImageUrl,
        is_premium: isPremium,
        status: "published",
      };

      if (draftId) {
        // Publish/update the existing post, then navigate to its (stable) slug.
        await postAPI.update(draftId, payload);
        toast({ title: "Story published!", variant: "success" });
        router.push(`/@${user?.username}/${existingSlug || generateSlug()}`);
      } else {
        const response = await postAPI.create({
          ...payload,
          slug: generateSlug(),
        });
        if (response.success && response.data) {
          toast({ title: "Story published!", variant: "success" });
          router.push(`/@${user?.username}/${response.data.slug}`);
        }
      }
    } catch (error) {
      console.error("Failed to publish:", error);
      toast({ title: "Failed to publish", variant: "error" });
    } finally {
      setPublishing(false);
    }
  };

  // Move a published post back to draft status (keeps content + slug intact).
  const handleMoveToDraft = async () => {
    if (!draftId) return;
    setPublishing(true);
    try {
      await postAPI.update(draftId, { status: "draft" });
      toast({ title: "Moved to drafts", variant: "success" });
      router.push("/dashboard/drafts");
    } catch (error) {
      console.error("Failed to move to draft:", error);
      toast({ title: "Failed to move to draft", variant: "error" });
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
            {saveStatus !== "saved" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSave}
                disabled={loading || publishing || !title.trim()}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save draft"}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(true)}
              disabled={!title.trim()}
              className="rounded-full"
            >
              <Eye className="h-4 w-4 mr-1" />
              Preview
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
        {/* Hidden file input for cover upload */}
        <input
          ref={coverFileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
          className="hidden"
          onChange={handleCoverUpload}
        />
        {!coverImageUrl && (
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => coverFileInputRef.current?.click()}
              disabled={coverUploading}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {coverUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}
              {coverUploading ? "Uploading..." : "Add cover image"}
            </button>
          </div>
        )}
        {coverImageUrl && (
          <div className="mb-6">
            <div className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverImageUrl}
                alt="Cover preview"
                className="max-h-48 rounded-lg border object-cover"
              />
              <button
                onClick={() => setCoverImageUrl("")}
                title="Remove cover image"
                className="absolute -top-2 -right-2 rounded-full bg-background border p-1 text-muted-foreground hover:text-foreground shadow"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
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

      {/* Preview Modal */}
      <Dialog.Root open={showPreview} onOpenChange={setShowPreview}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed inset-0 z-50 bg-background overflow-y-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
              <div className="container mx-auto flex h-14 items-center justify-between px-4 max-w-[780px]">
                <span className="text-sm font-medium text-muted-foreground">Preview</span>
                <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)} className="rounded-full">
                  <X className="h-4 w-4 mr-1" /> Close
                </Button>
              </div>
            </div>
            <div className="container mx-auto px-4 py-10 max-w-[680px]">
              {/* Title */}
              <div className="flex items-start gap-5 mb-6">
                <div className="flex-1 min-w-0">
                  <h1 className="text-3xl md:text-4xl lg:text-[42px] font-bold tracking-tight leading-tight">
                    {title || "Untitled"}
                  </h1>
                </div>
                {coverImageUrl && (
                  <div className="relative w-24 h-24 md:w-28 md:h-28 shrink-0 rounded-lg overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={coverImageUrl}
                      alt={title}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </div>
                )}
              </div>

              {/* Tags */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-8">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Author header */}
              <div className="flex items-center gap-3 mb-10">
                <div className="h-11 w-11 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <span className="text-sm font-medium">{user?.display_name?.[0] || "U"}</span>
                </div>
                <div>
                  <div className="font-medium">{user?.display_name || "You"}</div>
                  <div className="text-sm text-muted-foreground">
                    {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} ·{" "}
                    {Math.max(1, Math.ceil((content ? content.replace(/<[^>]*>/g, "").split(/\s+/).length : 0) / 200))} min read
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="prose prose-lg max-w-none">
                <div dangerouslySetInnerHTML={{ __html: renderPreviewContent(content) }} />
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

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
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setCoverImageUrl("")}
                    >
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
              {draftId && existingStatus === "published" && (
                <Button
                  variant="outline"
                  onClick={handleMoveToDraft}
                  disabled={publishing}
                  className="rounded-full px-5"
                >
                  Move to drafts
                </Button>
              )}
              <Dialog.Close asChild>
                <Button variant="ghost">Cancel</Button>
              </Dialog.Close>
              <Button
                onClick={handlePublish}
                disabled={publishing}
                className="rounded-full px-6"
              >
                {publishing ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{existingStatus === "published" ? "Updating..." : "Publishing..."}</>
                ) : (
                  draftId && existingStatus === "published" ? "Update & republish" : "Publish now"
                )}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

export default function WritePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading editor...
        </div>
      }
    >
      <WritePageEditor />
    </Suspense>
  );
}

// renderPreviewContent renders TipTap JSON content as HTML for the preview.
// Mirrors the renderContent logic from the post page.
function renderPreviewContent(content: string): string {
  if (!content) return "<p class=\"text-muted-foreground\">Start writing to see a preview...</p>";
  try {
    const doc = JSON.parse(content);
    return renderNodes(doc.content || []);
  } catch {
    return "<p>Unable to render preview.</p>";
  }
}

interface TipTapNode {
  type: string;
  content?: TipTapNode[];
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

function renderNodes(nodes: TipTapNode[]): string {
  return nodes.map(renderNode).join("");
}

function renderNode(node: TipTapNode): string {
  switch (node.type) {
    case "paragraph":
      return `<p>${renderNodes(node.content || [])}</p>`;
    case "heading": {
      const level = (node.attrs?.level as number) || 1;
      return `<h${level}>${renderNodes(node.content || [])}</h${level}>`;
    }
    case "bulletList":
      return `<ul>${renderNodes(node.content || [])}</ul>`;
    case "orderedList":
      return `<ol>${renderNodes(node.content || [])}</ol>`;
    case "listItem":
      return `<li>${renderNodes(node.content || [])}</li>`;
    case "blockquote":
      return `<blockquote>${renderNodes(node.content || [])}</blockquote>`;
    case "codeBlock":
      return `<pre><code>${renderNodes(node.content || [])}</code></pre>`;
    case "image":
      return `<img src="${(node.attrs?.src as string) || ""}" alt="${(node.attrs?.alt as string) || ""}" />`;
    case "text": {
      let text = node.text || "";
      if (node.marks) {
        node.marks.forEach((mark) => {
          switch (mark.type) {
            case "bold":
              text = `<strong>${text}</strong>`;
              break;
            case "italic":
              text = `<em>${text}</em>`;
              break;
            case "underline":
              text = `<u>${text}</u>`;
              break;
            case "strike":
              text = `<s>${text}</s>`;
              break;
            case "highlight":
              text = `<mark>${text}</mark>`;
              break;
            case "link":
              text = `<a href="${mark.attrs?.href || "#"}" target="_blank" rel="noopener noreferrer">${text}</a>`;
              break;
          }
        });
      }
      return text;
    }
    default:
      return renderNodes(node.content || []);
  }
}
