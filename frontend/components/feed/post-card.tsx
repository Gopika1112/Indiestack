"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Post, bookmarksAPI } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/components/toast-provider";
import { PostActions } from "@/components/post/post-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatRelativeDate, getInitials, truncate } from "@/lib/utils";
import { Clock, Bookmark, Star } from "lucide-react";

interface PostCardProps {
  post: Post;
}

export function PostCard({ post }: PostCardProps) {
  const { isAuthenticated } = useAuthStore();
  const { toast } = useToast();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggleBookmark = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      toast({ title: "Sign in to save posts", variant: "error" });
      return;
    }
    if (saving) return;

    const next = !saved;
    setSaved(next); // optimistic
    setSaving(true);
    try {
      if (next) {
        await bookmarksAPI.add(post.id);
        toast({ title: "Saved to your reading list", variant: "success" });
      } else {
        await bookmarksAPI.remove(post.id);
        toast({ title: "Removed from your reading list" });
      }
    } catch (err) {
      console.error("Bookmark toggle failed:", err);
      setSaved(!next); // revert on failure
      toast({ title: "Couldn't update bookmark", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="py-6 border-b border-border last:border-b-0">
      <Link href={`/@${post.author_username}/${post.slug}`} className="group block">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            {/* Author row */}
            <div className="flex items-center gap-2 mb-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={post.author_avatar} alt={post.author_name} />
                <AvatarFallback className="text-[10px]">
                  {getInitials(post.author_name || "U")}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-foreground">
                {post.author_name}
              </span>
              <span className="text-sm text-muted-foreground">·</span>
              <span className="text-sm text-muted-foreground">
                {formatRelativeDate(post.published_at || post.created_at)}
              </span>
            </div>

            {/* Title */}
            <h2 className="text-xl font-bold mb-1 line-clamp-2 group-hover:underline decoration-1 underline-offset-2">
              {post.title}
            </h2>

            {/* Excerpt */}
            <p className="text-muted-foreground text-[15px] leading-relaxed line-clamp-2 mb-3">
              {post.excerpt || truncate(JSON.stringify(post.content), 160)}
            </p>

            {/* Meta row */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {post.reading_time_minutes} min read
              </span>
              {post.is_premium && (
                <span className="flex items-center gap-1 text-amber-600">
                  <Star className="h-3.5 w-3.5 fill-current" />
                  Member only
                </span>
              )}
            </div>
          </div>

          {/* Thumbnail */}
          {post.cover_image_url && (
            <div className="relative w-28 h-28 flex-shrink-0 hidden sm:block rounded overflow-hidden">
              <Image
                src={post.cover_image_url}
                alt={post.title}
                fill
                sizes="112px"
                className="object-cover"
                loading="lazy"
              />
            </div>
          )}
        </div>
      </Link>

      {/* Action row (outside the Link so clicks don't navigate) */}
      <div className="flex items-center justify-between mt-2">
        <PostActions post={post} />
        <button
          onClick={toggleBookmark}
          disabled={saving}
          title={saved ? "Remove from reading list" : "Save to reading list"}
          className={`p-1.5 transition-colors rounded ${
            saved
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          } ${saving ? "opacity-50" : ""}`}
        >
          <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
        </button>
      </div>
    </article>
  );
}
