"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function ExplorePage() {
  const [posts, setPosts] = useState<any[]>([]);
  useEffect(() => {
    fetch("/api/v1/feed/trending").then(r => r.json()).then(d => setPosts(d.data || []));
  }, []);
  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-2">Explore</h1>
      <p className="text-muted-foreground mb-8">Discover trending stories from writers around the world.</p>
      <div className="space-y-6">
        {posts.map((p: any) => (
          <div key={p.id} className="border rounded-lg p-6 hover:shadow-md transition-shadow">
            <Link href={`/@${p.author_username}/${p.slug}`}>
              <h2 className="text-xl font-semibold mb-2">{p.title}</h2>
            </Link>
            <p className="text-muted-foreground line-clamp-2 mb-3">{p.excerpt}</p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{p.author_name}</span>
              <span>{p.reading_time_minutes} min read</span>
              <span>{p.view_count} views</span>
              <span>{p.like_count} likes</span>
            </div>
          </div>
        ))}
        {posts.length === 0 && <p className="text-muted-foreground">No trending posts yet.</p>}
      </div>
    </div>
  );
}
