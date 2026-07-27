"use client";
import { useState } from "react";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const search = async () => {
    if (!query.trim()) return;
    const res = await fetch(`/api/v1/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setResults(data.data || []);
  };
  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Search</h1>
      <div className="flex gap-2 mb-8">
        <input className="flex-1 border rounded-lg px-4 py-2" placeholder="Search articles..." value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && search()} />
        <button className="bg-primary text-primary-foreground px-6 py-2 rounded-lg" onClick={search}>Search</button>
      </div>
      <div className="space-y-4">
        {results.map((r: any) => (
          <a key={r.id} href={`/article/${r.slug}`} className="block border rounded-lg p-4 hover:shadow-md">
            <h3 className="font-semibold">{r.title}</h3>
            <p className="text-sm text-muted-foreground">{r.excerpt}</p>
          </a>
        ))}
        {results.length === 0 && query && <p className="text-muted-foreground">No results found.</p>}
      </div>
    </div>
  );
}
