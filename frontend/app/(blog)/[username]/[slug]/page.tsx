import type { Metadata } from "next";
import { PostPageClient } from "./post-page-client";

// Server-side base URL for the Go API (inside Docker this is the go-api service).
// API_URL env var is "http://go-api:3001" (no /api/v1), so we append it here.
const API_BASE = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://go-api:3001";
const API_URL = API_BASE.endsWith("/api/v1") ? API_BASE : `${API_BASE}/api/v1`;

interface PostMeta {
  title: string;
  excerpt: string;
  cover_image_url: string;
  author_name: string;
  author_username: string;
  tags?: string[];
}

async function fetchPost(username: string, slug: string): Promise<PostMeta | null> {
  try {
    const res = await fetch(`${API_URL}/posts/slug/${username}/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.data as PostMeta) || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}): Promise<Metadata> {
  const { username, slug } = await params;
  const clean = decodeURIComponent(username).replace(/^@/, "");
  const post = await fetchPost(clean, slug);
  if (!post) {
    return { title: "Post not found" };
  }
  const description = post.excerpt || `Read ${post.title} by ${post.author_name} on IndieStack.`;
  const url = `/@${post.author_username}/${slug}`;
  return {
    title: post.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description,
      type: "article",
      url,
      authors: [post.author_name],
      tags: post.tags,
      images: post.cover_image_url ? [post.cover_image_url] : undefined,
    },
    twitter: {
      card: post.cover_image_url ? "summary_large_image" : "summary",
      title: post.title,
      description,
      images: post.cover_image_url ? [post.cover_image_url] : undefined,
    },
  };
}

export default function PostPage() {
  return <PostPageClient />;
}
