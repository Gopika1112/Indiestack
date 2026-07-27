"use client";
import { useState, useEffect } from "react";
export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) fetch("/api/v1/bookmarks", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(d => setBookmarks(d.data || []));
  }, []);
  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Bookmarks</h1>
      <div className="space-y-4">
        {bookmarks.map((b: any) => (
          <a key={b.post_id} href={`/article/${b.slug}`} className="block border rounded-lg p-4 hover:shadow-md">
            <h3 className="font-semibold">{b.title}</h3>
          </a>
        ))}
        {bookmarks.length === 0 && <p className="text-muted-foreground">No bookmarks yet. Save articles to read later.</p>}
      </div>
    </div>
  );
}
