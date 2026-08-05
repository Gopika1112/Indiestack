"use client";


import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { FloatingToolbar } from "@/components/post/floating-toolbar";
import { PostActions } from "@/components/post/post-actions";
import { RelatedPosts } from "@/components/post/related-posts";
import { postAPI, userAPI, historyAPI, Post } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/components/toast-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, getInitials } from "@/lib/utils";
import { Clock } from "lucide-react";
import type { TipTapDoc, TipTapNode, TipTapMark } from "@/lib/tiptap-types";

export default function PostPage() {
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
  const { user, isAuthenticated } = useAuthStore();
  const { toast } = useToast();

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

      <div className="container mx-auto px-4 py-12 max-w-[1200px]">
        <div className="lg:flex lg:justify-center lg:gap-12">
          {/* Main column — centered */}
          <article className="max-w-[680px] w-full min-w-0">
        {/* Title */}
        <h1 className="text-3xl md:text-4xl lg:text-[42px] font-bold tracking-tight leading-tight mb-6">
          {post.title}
        </h1>

        {/* Author */}
        <div className="flex items-center gap-3 mb-10">
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
              <span>·</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {post.reading_time_minutes} min read
              </span>
            </div>
          </div>
        </div>

        {/* Cover Image (hidden if it fails to load). Plain <img> because the
            cover is served by the backend via Caddy at a relative /uploads path
            that next/image's optimizer can't reach. */}
        {post.cover_image_url && !coverError && (
          <div className="relative aspect-video mb-10 rounded-lg overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.cover_image_url}
              alt={post.title}
              className="absolute inset-0 h-full w-full object-cover"
              onError={() => setCoverError(true)}
            />
          </div>
        )}

        {/* Content */}
        <div className="prose prose-lg max-w-none mb-10">
          {post.content && (
            <div dangerouslySetInnerHTML={{ __html: renderContent(post.content) }} />
          )}
        </div>

        {/* Like / Comment / Repost / Share */}
        <div className="border-y py-3 mb-12">
          <PostActions post={post} showComments />
        </div>

        {/* Author Card */}
        <div className="border-t pt-8">
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
            <Button className="rounded-full px-5">Follow</Button>
          </div>
        </div>
          </article>

          {/* Related posts rail — sits in the free space to the right of the
              centered content on desktop; stacked below on mobile */}
          <aside className="mt-12 lg:mt-0 lg:w-[320px] lg:shrink-0">
            <div className="lg:sticky lg:top-12 border-t lg:border-t-0 border-border pt-8 lg:pt-0">
              <h3 className="text-base font-bold mb-5">Related posts</h3>
              <RelatedPosts postId={post.id} />
            </div>
          </aside>
        </div>
      </div>

      {/* Floating toolbar */}
      <FloatingToolbar postId={post.id} likeCount={post.like_count} commentCount={post.comment_count} />
    </div>
  );
}

// ── TipTap content renderer ─────────────────────────────────────────

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
