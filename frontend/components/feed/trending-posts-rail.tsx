"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { feedAPI, Post } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp } from "lucide-react";

// TrendingPostsRail shows the most-viewed posts in the last 24 hours.
export function TrendingPostsRail() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    feedAPI
      .getTrendingPosts()
      .then((res) => {
        if (!cancelled) setPosts(res.data || []);
      })
      .catch(() => {
        if (!cancelled) setPosts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-4 w-4 text-orange-500" />
        <h3 className="text-sm font-bold">Trending now</h3>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <p className="text-xs text-muted-foreground">No trending posts yet.</p>
      ) : (
        <ul className="space-y-5">
          {posts.slice(0, 4).map((p) => (
            <li key={p.id}>
              <Link href={`/@${p.author_username}/${p.slug}`} className="group block">
                <div className="flex items-center gap-1.5 mb-1">
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={p.author_avatar} alt={p.author_name} />
                    <AvatarFallback className="text-[8px]">
                      {getInitials(p.author_name || "U")}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground truncate">{p.author_name}</span>
                </div>
                <h4 className="text-sm font-semibold leading-snug group-hover:underline line-clamp-2 text-foreground">
                  {p.title}
                </h4>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
