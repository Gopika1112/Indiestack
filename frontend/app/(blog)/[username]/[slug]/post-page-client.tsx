"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { FloatingToolbar } from "@/components/post/floating-toolbar";
import { PostActions } from "@/components/post/post-actions";
import { RelatedPosts } from "@/components/post/related-posts";
import { postAPI, userAPI, historyAPI, settingsAPI, highlightsAPI, publicationsAPI, listsAPI, responsesAPI, Post, Publication, ReadingList } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/components/toast-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatRelativeDate, getInitials } from "@/lib/utils";
import { Clock, Loader2, Trash2, Highlighter, BookOpen, List, MoreHorizontal, Pencil, BarChart3 } from "lucide-react";
import type { TipTapDoc, TipTapNode, TipTapMark } from "@/lib/tiptap-types";

// Map the reader's highlight_color preference to an actual CSS color for <mark>.
const HIGHLIGHT_COLORS: Record<string, string> = {
  yellow: "#fef08a",
  green: "#bbf7d0",
  blue: "#bfdbfe",
  pink: "#fbcfe8",
};
// Dark-mode-friendly highlight colors (deeper so white text stays readable).
const HIGHLIGHT_COLORS_DARK: Record<string, string> = {
  yellow: "#a16207",
  green: "#15803d",
  blue: "#1d4ed8",
  pink: "#be185d",
};
const READING_FONTS: Record<string, string> = {
  sans: "ui-sans-serif, system-ui, sans-serif",
  serif: "Georgia, Cambria, 'Times New Roman', serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
};
const FONT_SIZES: Record<string, string> = {
  small: "17px",
  medium: "19px",
  large: "22px",
};
const LINE_SPACINGS: Record<string, string> = {
  compact: "1.6",
  normal: "1.8",
  relaxed: "2.1",
};

// A post counts as "edited" if it was meaningfully updated after publishing.
function isEdited(post: Post): boolean {
  if (!post.updated_at || !post.published_at) return false;
  return new Date(post.updated_at).getTime() - new Date(post.published_at).getTime() > 60_000;
}

export function PostPageClient() {
  const params = useParams();
  const rawUsername = decodeURIComponent(params.username as string);
  const username = rawUsername.startsWith("@") ? rawUsername.slice(1) : rawUsername;
  const slug = params.slug as string;

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [coverError, setCoverError] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hlPopup, setHlPopup] = useState<{ text: string; x: number; y: number } | null>(null);
  const [savingHl, setSavingHl] = useState(false);
  const [pubOpen, setPubOpen] = useState(false);
  const [myPubs, setMyPubs] = useState<Publication[]>([]);
  const [pubLoading, setPubLoading] = useState(false);
  const [submittingPub, setSubmittingPub] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [myLists, setMyLists] = useState<ReadingList[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [submittingList, setSubmittingList] = useState<string | null>(null);
  const [responses, setResponses] = useState<Post[]>([]);
  const [responsesLoading, setResponsesLoading] = useState(false);
  const [responseOpen, setResponseOpen] = useState(false);
  const [responseTitle, setResponseTitle] = useState("");
  const [responseContent, setResponseContent] = useState("");
  const [submittingResponse, setSubmittingResponse] = useState(false);
  const [stats, setStats] = useState<{ views: number; claps: number; comments: number; reposts: number } | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const [readingPrefs, setReadingPrefs] = useState({
    highlight_color: "yellow",
    reading_font: "sans",
    font_size: "medium",
    line_spacing: "normal",
  });
  const { user, isAuthenticated } = useAuthStore();
  const { toast } = useToast();
  const router = useRouter();

  const handleFollow = async () => {
    if (!isAuthenticated) {
      toast({ title: "Sign in to follow authors", variant: "error" });
      return;
    }
    if (!post) return;
    setFollowLoading(true);
    const next = !isFollowing;
    try {
      if (next) {
        await userAPI.follow(post.author_id);
        setIsFollowing(true);
        toast({ title: `Following ${post.author_name}`, variant: "success" });
      } else {
        await userAPI.unfollow(post.author_id);
        setIsFollowing(false);
      }
    } catch (error) {
      console.error("Follow action failed:", error);
      toast({ title: "Couldn't update follow", variant: "error" });
    } finally {
      setFollowLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!post) return;
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await postAPI.delete(post.id);
      toast({ title: "Post deleted", variant: "success" });
      router.push("/feed");
    } catch (error) {
      console.error("Delete failed:", error);
      toast({ title: "Failed to delete post", variant: "error" });
      setDeleting(false);
    }
  };

  const openPublishToPub = async () => {
    if (!post) return;
    setPubOpen(true);
    setPubLoading(true);
    try {
      const res = await publicationsAPI.listMine();
      setMyPubs(res.data || []);
    } catch (err) {
      console.error("Failed to load publications:", err);
      setMyPubs([]);
    } finally {
      setPubLoading(false);
    }
  };

  const submitToPublication = async (pubSlug: string) => {
    if (!post) return;
    setSubmittingPub(pubSlug);
    try {
      await publicationsAPI.addPost(pubSlug, post.id);
      toast({ title: "Added to publication", variant: "success" });
      setPubOpen(false);
    } catch (err) {
      console.error("Submit to publication failed:", err);
      toast({ title: "Couldn't add to publication", variant: "error" });
    } finally {
      setSubmittingPub(null);
    }
  };

  const openSaveToList = async () => {
    if (!isAuthenticated) {
      toast({ title: "Sign in to save to a list", variant: "error" });
      return;
    }
    if (!post) return;
    setListOpen(true);
    setListLoading(true);
    try {
      const res = await listsAPI.listMine();
      setMyLists(res.data || []);
    } catch (err) {
      console.error("Failed to load lists:", err);
      setMyLists([]);
    } finally {
      setListLoading(false);
    }
  };

  const saveToList = async (listId: string) => {
    if (!post) return;
    setSubmittingList(listId);
    try {
      await listsAPI.addItem(listId, post.id);
      toast({ title: "Saved to list", variant: "success" });
      setListOpen(false);
    } catch (err) {
      console.error("Save to list failed:", err);
      toast({ title: "Couldn't save to list", variant: "error" });
    } finally {
      setSubmittingList(null);
    }
  };

  const loadResponses = async () => {
    if (!post) return;
    setResponsesLoading(true);
    try {
      const res = await responsesAPI.list(post.id);
      setResponses(res.data || []);
    } catch (err) {
      console.error("Load responses failed:", err);
      setResponses([]);
    } finally {
      setResponsesLoading(false);
    }
  };

  const submitResponse = async () => {
    if (!post || !responseTitle.trim() || !responseContent.trim()) return;
    setSubmittingResponse(true);
    try {
      await responsesAPI.create({
        parent_post_id: post.id,
        title: responseTitle.trim(),
        content: {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: responseContent.trim() }] }],
        },
        excerpt: responseContent.trim().slice(0, 150),
      });
      toast({ title: "Response published", variant: "success" });
      setResponseOpen(false);
      setResponseTitle("");
      setResponseContent("");
      await loadResponses();
    } catch (err) {
      console.error("Submit response failed:", err);
      toast({ title: "Couldn't publish response", variant: "error" });
    } finally {
      setSubmittingResponse(false);
    }
  };

  const loadStats = async () => {
    if (!post) return;
    try {
      const res = await postAPI.getStats(post.id);
      if (res.data) setStats(res.data);
    } catch (err) {
      console.error("Load stats failed:", err);
    }
  };

  // Reader highlight: capture a text selection inside the article and offer to
  // save it as a highlight.
  const handleMouseUp = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      setHlPopup(null);
      return;
    }
    const text = sel.toString().trim();
    if (!text || text.length < 3 || text.length > 2000) {
      setHlPopup(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setHlPopup({ text, x: rect.left + rect.width / 2, y: rect.top });
  };

  const saveHighlight = async () => {
    if (!post || !hlPopup) return;
    if (!isAuthenticated) {
      toast({ title: "Sign in to save highlights", variant: "error" });
      return;
    }
    setSavingHl(true);
    try {
      await highlightsAPI.add(post.id, hlPopup.text, readingPrefs.highlight_color);
      toast({ title: "Highlight saved", variant: "success" });
      setHlPopup(null);
      window.getSelection()?.removeAllRanges();
    } catch (err) {
      console.error("Save highlight failed:", err);
      toast({ title: "Couldn't save highlight", variant: "error" });
    } finally {
      setSavingHl(false);
    }
  };













  const loadPost = useCallback(async () => {
    setLoading(true);
    try {
      const response = await postAPI.getBySlug(username, slug);
      if (response.success && response.data) {
        setPost(response.data);
        // Record this read in the user's history (fire-and-forget; only when signed in).
        if (isAuthenticated && response.data.id) {
          historyAPI.record(response.data.id).catch(() => {
            // Non-fatal: history recording should never block reading.
          });
        }
      }
    } catch (error) {
      console.error("Failed to load post:", error);
    } finally {
      setLoading(false);
    }
  }, [username, slug, isAuthenticated]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  // Load responses when the post loads.
  useEffect(() => {
    if (post) loadResponses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.id]);

  // Load the reader's display preferences (font, size, spacing, highlight color).
  useEffect(() => {
    if (!isAuthenticated) return;
    settingsAPI
      .getReading()
      .then((res) => {
        const d = (res.data as Record<string, unknown> | undefined) || {};
        setReadingPrefs((prev) => ({
          highlight_color: typeof d.highlight_color === "string" && d.highlight_color ? d.highlight_color : prev.highlight_color,
          reading_font: typeof d.reading_font === "string" && d.reading_font ? d.reading_font : prev.reading_font,
          font_size: typeof d.font_size === "string" && d.font_size ? d.font_size : prev.font_size,
          line_spacing: typeof d.line_spacing === "string" && d.line_spacing ? d.line_spacing : prev.line_spacing,
        }));
      })
      .catch(() => {});
  }, [isAuthenticated]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? (scrollTop / docHeight) * 100 : 0);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);















  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-12 max-w-[680px]">
          <Skeleton className="h-10 w-3/4 mb-6" />
          <div className="flex items-center gap-3 mb-10">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-64 w-full rounded-lg" />
        </main>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-12 text-center max-w-[680px]">
          <h1 className="text-2xl font-bold mb-4">Post not found</h1>
          <p className="text-muted-foreground">
            The post you&apos;re looking for doesn&apos;t exist.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Reading progress bar */}
      <div className="reading-progress" style={{ width: `${progress}%` }} />

      <div className="container mx-auto px-4 py-12">
        {/* Content is centered on screen (max-w + mx-auto). The related rail is
            pinned to the right edge of the viewport on large screens. */}
        <article className="max-w-[680px] mx-auto min-w-0">
        {/* Title row: small cover thumbnail beside the title */}
        <div className="flex items-start gap-5 mb-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl md:text-4xl lg:text-[42px] font-bold tracking-tight leading-tight">
              {post.title}
            </h1>
          </div>
          {post.cover_image_url && !coverError && (
            <div className="relative w-24 h-24 md:w-28 md:h-28 shrink-0 rounded-lg overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.cover_image_url}
                alt={post.title}
                className="absolute inset-0 h-full w-full object-cover"
                onError={() => setCoverError(true)}
              />
            </div>
          )}
        </div>

        {/* Category tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {post.tags.map((tag) => (
              <Link
                key={tag}
                href={`/discover?tag=${encodeURIComponent(tag)}`}
                className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors"
              >
                {tag}
              </Link>
            ))}
          </div>
        )}

        {/* Author header — author info on left, author actions (Edit/Delete/⋯) on right */}
        <div className="flex items-start justify-between gap-4 mb-10">
          {/* Author info row */}
          <div className="flex items-center gap-3">
            <Link href={`/@${post.author_username}`}>
              <Avatar className="h-11 w-11">
                <AvatarImage src={post.author_avatar} alt={post.author_name} />
                <AvatarFallback>{getInitials(post.author_name)}</AvatarFallback>
              </Avatar>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/@${post.author_username}`}
                  className="font-medium hover:underline"
                >
                  {post.author_name}
                </Link>
                {user?.id !== post.author_id && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleFollow}
                      disabled={followLoading}
                      className="text-primary h-auto p-0 font-normal"
                    >
                      {isFollowing ? "Following" : "Follow"}
                    </Button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{formatDate(post.published_at || post.created_at)}</span>
                {isEdited(post) && (
                  <>
                    <span>·</span>
                    <span className="italic">Edited</span>
                  </>
                )}
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {post.reading_time_minutes} min read
                </span>
              </div>
            </div>
          </div>

          {/* Author actions: Edit, Delete, Stats, and ⋯ menu — next to author name */}
          {isAuthenticated && user?.id === post.author_id && (
            <div className="flex items-center gap-2 shrink-0">
              <Link href={`/write?draft=${post.id}`}>
                <Button variant="outline" size="sm" className="rounded-full">
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { loadStats(); setStatsOpen(true); }}
                className="rounded-full"
              >
                <BarChart3 className="h-4 w-4 mr-1" />
                Stats
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-full text-destructive hover:text-destructive border-destructive/40"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </>
                )}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-full">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={openPublishToPub} className="cursor-pointer">
                    <BookOpen className="mr-2 h-4 w-4" />
                    Add to publication
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={openSaveToList} className="cursor-pointer">
                    <List className="mr-2 h-4 w-4" />
                    Save to list
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* Reader: just Save to list — next to author name */}
          {isAuthenticated && user?.id !== post.author_id && (
            <div className="shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={openSaveToList}
                className="rounded-full"
              >
                <List className="h-4 w-4 mr-1" />
                Save to list
              </Button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="prose prose-lg max-w-none mb-10">
          {/* Apply the reader's display preferences: font, size, spacing, and a
              dark-mode-aware highlight color for <mark> highlights. */}
          <style>{`
            .post-content{font-family:${READING_FONTS[readingPrefs.reading_font] || READING_FONTS.sans};font-size:${FONT_SIZES[readingPrefs.font_size] || FONT_SIZES.medium};line-height:${LINE_SPACINGS[readingPrefs.line_spacing] || LINE_SPACINGS.normal}}
            .post-content mark{background-color:${HIGHLIGHT_COLORS[readingPrefs.highlight_color] || HIGHLIGHT_COLORS.yellow};color:#18181b;padding:0 2px;border-radius:2px}
            .dark .post-content mark{background-color:${HIGHLIGHT_COLORS_DARK[readingPrefs.highlight_color] || HIGHLIGHT_COLORS_DARK.yellow};color:#fafafa}
          `}</style>
          {post.content && (
            <div
              className="post-content"
              onMouseUp={handleMouseUp}
              dangerouslySetInnerHTML={{ __html: renderContent(post.content) }}
            />
          )}
        </div>

        {/* Highlight-save popup on text selection */}
        {hlPopup && (
          <button
            onClick={saveHighlight}
            disabled={savingHl}
            style={{
              position: "fixed",
              left: hlPopup.x,
              top: hlPopup.y - 8,
              transform: "translate(-50%, -100%)",
            }}
            className="z-50 flex items-center gap-1.5 rounded-full bg-foreground text-background px-3 py-1.5 text-xs font-medium shadow-lg"
          >
            {savingHl ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Highlighter className="h-3.5 w-3.5" />}
            Highlight
          </button>
        )}

        {/* Like / Comment / Repost / Share */}
        <div className="border-y py-3 mb-12">
          <PostActions post={post} showComments />
        </div>

        {/* Author Card */}
        <div className="border-t pt-8 mb-8">
          <div className="flex items-start gap-4">
            <Link href={`/@${post.author_username}`}>
              <Avatar className="h-16 w-16">
                <AvatarImage src={post.author_avatar} alt={post.author_name} />
                <AvatarFallback className="text-xl">
                  {getInitials(post.author_name)}
                </AvatarFallback>
              </Avatar>
            </Link>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Written by
              </p>
              <Link
                href={`/@${post.author_username}`}
                className="font-bold text-xl hover:underline"
              >
                {post.author_name}
              </Link>
              <p className="text-muted-foreground mt-1 text-sm">@{post.author_username}</p>
            </div>
            {isAuthenticated && user?.id !== post.author_id && (
              <Button
                onClick={handleFollow}
                disabled={followLoading}
                variant={isFollowing ? "outline" : "default"}
                className="rounded-full px-5"
              >
                {isFollowing ? "Following" : "Follow"}
              </Button>
            )}
          </div>
        </div>

        {/* Responses */}
        <div className="border-t pt-8 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              Responses {responses.length > 0 && `(${responses.length})`}
            </h3>
            {isAuthenticated && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => setResponseOpen(true)}
              >
                Write a response
              </Button>
            )}
          </div>

          {responsesLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading responses...
            </div>
          ) : responses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No responses yet. Be the first to respond.
            </p>
          ) : (
            <div className="space-y-4">
              {responses.map((r) => (
                <div key={r.id} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={r.author_avatar} alt={r.author_name} />
                      <AvatarFallback className="text-[10px]">{getInitials(r.author_name)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{r.author_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeDate(r.published_at || r.created_at)}
                    </span>
                  </div>
                  <h4 className="font-semibold text-base mb-1">{r.title}</h4>
                  <div className="text-sm text-foreground whitespace-pre-wrap">
                    {renderResponseContent(r.content)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
          </article>

          {/* Related posts rail — pinned to the right edge of the screen on wide
              viewports (xl+), occupying the margin beside the centered 680px
              content; stacked below the content on smaller screens */}
          <aside className="mt-12 xl:mt-0 xl:fixed xl:top-24 xl:right-4 xl:w-[280px]">
            <div className="border-t xl:border-t-0 border-border pt-8 xl:pt-0">
              <h3 className="text-base font-bold mb-5">Related posts</h3>
              <RelatedPosts postId={post.id} />
            </div>
          </aside>
      </div>

      {/* Floating toolbar */}
      <FloatingToolbar postId={post.id} likeCount={post.like_count} commentCount={post.comment_count} />

      {/* Add-to-publication modal */}
      {pubOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setPubOpen(false)} />
          <div className="relative z-10 w-full max-w-md bg-background rounded-xl border shadow-2xl p-6">
            <h3 className="text-lg font-semibold mb-1">Add to publication</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Choose a publication you&apos;re a member of.
            </p>
            {pubLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-6 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
              </div>
            ) : myPubs.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-3">
                  You&apos;re not a member of any publication yet.
                </p>
                <Link href="/publications/new" onClick={() => setPubOpen(false)}>
                  <Button variant="outline" className="rounded-full">Create a publication</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {myPubs.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => submitToPublication(p.slug)}
                    disabled={submittingPub !== null}
                    className="w-full flex items-center gap-3 border rounded-lg p-3 hover:bg-muted/40 transition-colors text-left"
                  >
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                      {p.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.logo_url} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <BookOpen className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">{p.name}</span>
                    </div>
                    {submittingPub === p.slug && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Save-to-list modal */}
      {listOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setListOpen(false)} />
          <div className="relative z-10 w-full max-w-md bg-background rounded-xl border shadow-2xl p-6">
            <h3 className="text-lg font-semibold mb-1">Save to list</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Choose one of your lists.
            </p>
            {listLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-6 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
              </div>
            ) : myLists.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-3">
                  You don&apos;t have any lists yet.
                </p>
                <Link href="/lists/new" onClick={() => setListOpen(false)}>
                  <Button variant="outline" className="rounded-full">Create a list</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {myLists.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => saveToList(l.id)}
                    disabled={submittingList !== null}
                    className="w-full flex items-center gap-3 border rounded-lg p-3 hover:bg-muted/40 transition-colors text-left"
                  >
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <List className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">{l.name}</span>
                      <p className="text-xs text-muted-foreground">{l.item_count} stories</p>
                    </div>
                    {submittingList === l.id && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats modal */}
      {statsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setStatsOpen(false)} />
          <div className="relative z-10 w-full max-w-md bg-background rounded-xl border shadow-2xl p-6">
            <h3 className="text-lg font-semibold mb-1">Story stats</h3>
            <p className="text-sm text-muted-foreground mb-4">
              How your story is performing.
            </p>
            {stats ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold">{stats.views}</div>
                  <div className="text-sm text-muted-foreground">Views</div>
                </div>
                <div className="border rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold">{stats.claps}</div>
                  <div className="text-sm text-muted-foreground">Claps</div>
                </div>
                <div className="border rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold">{stats.comments}</div>
                  <div className="text-sm text-muted-foreground">Comments</div>
                </div>
                <div className="border rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold">{stats.reposts}</div>
                  <div className="text-sm text-muted-foreground">Reposts</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground py-6 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading stats...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Write-a-response modal */}
      {responseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setResponseOpen(false)} />
          <div className="relative z-10 w-full max-w-lg bg-background rounded-xl border shadow-2xl p-6">
            <h3 className="text-lg font-semibold mb-1">Write a response</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Respond to &quot;{post.title}&quot; with your own story.
            </p>
            <div className="space-y-3">
              <Input
                placeholder="Response title"
                value={responseTitle}
                onChange={(e) => setResponseTitle(e.target.value)}
                className="rounded-lg"
              />
              <Textarea
                placeholder="Write your response..."
                value={responseContent}
                onChange={(e) => setResponseContent(e.target.value)}
                rows={6}
                className="rounded-lg resize-none"
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setResponseOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={submitResponse}
                  disabled={submittingResponse || !responseTitle.trim() || !responseContent.trim()}
                  className="rounded-full"
                >
                  {submittingResponse ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Publish response"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── TipTap content renderer ─────────────────────────────────────────

// renderResponseContent renders a response's TipTap content as plain text
// (responses are inline, so we don't need full HTML rendering).
function renderResponseContent(content: unknown): string {
  if (typeof content === "string") {
    try {
      const parsed = JSON.parse(content);
      return extractText(parsed);
    } catch {
      return content;
    }
  }
  return extractText(content);
}

function extractText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as Record<string, unknown>;
  if (n.type === "text" && typeof n.text === "string") return n.text;
  if (Array.isArray(n.content)) {
    return n.content.map(extractText).join(" ");
  }
  return "";
}

function renderContent(content: unknown): string {
  if (typeof content === "string") {
    try {
      const parsed = JSON.parse(content);
      const doc = parsed as TipTapDoc | null;
      if (!doc || !doc.content) return "";
      return renderNodes(doc.content);
    } catch {
      return content;
    }
  }
  const parsed = content;

  const doc = parsed as TipTapDoc | null;
  if (!doc || !doc.content) {
    return "";
  }

  return renderNodes(doc.content);
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
        node.marks.forEach((mark: TipTapMark) => {
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
