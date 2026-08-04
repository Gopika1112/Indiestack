"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search as SearchIcon, Loader2 } from "lucide-react";

interface SearchResult {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  author_id: string;
  author_username: string;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/v1/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.data || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-[680px]">
      <h1 className="text-3xl font-bold mb-6">Search</h1>
      <div className="flex gap-2 mb-8">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-10 rounded-full"
            placeholder="Search stories by title, content, or tag..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
        </div>
        <Button className="rounded-full px-6" onClick={search} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </div>

      <div className="space-y-1">
        {results.map((r) => (
          <Link
            key={r.id}
            href={`/@${r.author_username}/${r.slug}`}
            className="block border-b border-border py-4 hover:bg-muted/40 rounded-md px-3 -mx-3 transition-colors"
          >
            <h3 className="font-semibold text-lg">{r.title}</h3>
            {r.excerpt && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{r.excerpt}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">by @{r.author_username}</p>
          </Link>
        ))}
        {searched && !loading && results.length === 0 && (
          <p className="text-muted-foreground text-center py-12">No results found for &quot;{query}&quot;.</p>
        )}
      </div>
    </div>
  );
}
