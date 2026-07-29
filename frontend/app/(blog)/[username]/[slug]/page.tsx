"use client";


import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Navbar } from "@/components/navbar";
import { FloatingToolbar } from "@/components/post/floating-toolbar";
import { postAPI, Post } from "@/lib/api";
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













  const loadPost = useCallback(async () => {
    setLoading(true);
    try {
      const response = await postAPI.getBySlug(username, slug);
      if (response.success && response.data) {
        setPost(response.data);
      }
    } catch (error) {
      console.error("Failed to load post:", error);
    } finally {
      setLoading(false);
    }
  }, [username, slug]);

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
        <Navbar />
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
        <Navbar />
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

      <Navbar />
      <article className="container mx-auto px-4 py-12 max-w-[680px]">
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
              <span className="text-muted-foreground">·</span>
              <Button variant="ghost" size="sm" className="text-primary h-auto p-0 font-normal">
                Follow
              </Button>
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

        {/* Cover Image */}
        {post.cover_image_url && (
          <div className="relative aspect-video mb-10 rounded-lg overflow-hidden">
            <Image
              src={post.cover_image_url}
              alt={post.title}
              fill
              sizes="680px"
              className="object-cover"
              priority
            />
          </div>
        )}

        {/* Content */}
        <div className="prose prose-lg max-w-none mb-16">
          {post.content && (
            <div dangerouslySetInnerHTML={{ __html: renderContent(post.content) }} />
          )}
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

      {/* Floating toolbar */}
      <FloatingToolbar likeCount={post.like_count} commentCount={post.comment_count} />
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
