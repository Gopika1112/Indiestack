"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { postAPI, Post } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials, formatRelativeDate } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// RelatedPosts shows a "Related posts" rail for the given post. It ranks by
// shared tags first, then full-text (tsvector) similarity, via the backend.
export function RelatedPosts({ postId }: { postId: string }) {
  const [related, setRelated] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!postId) return;
    let cancelled = false;
    setLoading(true);
    postAPI
      .getRelated(postId)
      .then((res) => {
        if (!cancelled) setRelated(res.data || []);
      })
      .catch(() => {
        if (!cancelled) setRelated([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [postId]);

  if (loading) {
    return (
      <div className="space-y-5">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ))}
      </div>
    );
  }

  if (related.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No related posts yet.</p>
    );
  }

  return (
    <div className="space-y-5">
      {related.map((p) => (
        <div key={p.id}>
          <Link href={`/@${p.author_username}/${p.slug}`} className="group block">
            <div className="flex items-center gap-2 mb-1.5">
              <Avatar className="h-5 w-5">
                <AvatarImage src={p.author_avatar} alt={p.author_name} />
                <AvatarFallback className="text-[9px]">
                  {getInitials(p.author_name || "U")}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium text-foreground truncate">
                {p.author_name}
              </span>
            </div>
            <h4 className="text-sm font-bold leading-snug group-hover:underline decoration-1 underline-offset-2 line-clamp-2">
              {p.title}
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              {formatRelativeDate(p.published_at || p.created_at)}
              {p.tags && p.tags.length > 0 && (
                <span> · {p.tags.slice(0, 2).join(", ")}</span>
              )}
            </p>
          </Link>
        </div>
      ))}
    </div>
  );
}
