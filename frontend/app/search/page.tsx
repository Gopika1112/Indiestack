"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search as SearchIcon, Loader2, Hash, Users, FileText, BookOpen, List } from "lucide-react";
import { getInitials } from "@/lib/utils";

interface StoryResult {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  author_id: string;
  author_username: string;
  author_name: string;
  author_avatar: string;
  tags: string[];
  published_at: string | null;
  like_count: number;
}

interface PersonResult {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  follower_count: number;
  is_verified: boolean;
}

interface TopicResult {
  tag: string;
  count: number;
}

interface PublicationResult {
  id: string;
  name: string;
  slug: string;
  description: string;
  logo_url: string;
  follower_count: number;
  post_count: number;
}

interface ListResult {
  id: string;
  name: string;
  description: string;
  owner_username: string;
  owner_name: string;
  item_count: number;
}

interface SearchData {
  stories: StoryResult[];
  people: PersonResult[];
  topics: TopicResult[];
  publications: PublicationResult[];
  lists: ListResult[];
}

type Tab = "stories" | "people" | "topics" | "publications" | "lists";

const TABS: { key: Tab; label: string; icon: typeof FileText }[] = [
  { key: "stories", label: "Stories", icon: FileText },
  { key: "people", label: "People", icon: Users },
  { key: "topics", label: "Topics", icon: Hash },
  { key: "publications", label: "Publications", icon: BookOpen },
  { key: "lists", label: "Lists", icon: List },
];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<SearchData | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("stories");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = async (q: string) => {
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/v1/search?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      setData(json.data || null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  // Live search-as-you-type: debounce keystrokes so results update as the user
  // types each letter, without requiring a full word or an explicit click.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) {
      setData(null);
      setSearched(false);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      runSearch(q);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const search = () => {
    const q = query.trim();
    if (!q) return;
    setActiveTab("stories");
    runSearch(q);
  };

  const counts: Record<Tab, number> = {
    stories: data?.stories.length ?? 0,
    people: data?.people.length ?? 0,
    topics: data?.topics.length ?? 0,
    publications: data?.publications.length ?? 0,
    lists: data?.lists.length ?? 0,
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-[680px]">
      <h1 className="text-3xl font-bold mb-6">Search</h1>
      <div className="flex gap-2 mb-8">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-10 rounded-full"
            placeholder="Search stories, people, topics..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
        </div>
        <Button className="rounded-full px-6" onClick={search} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </div>

      {!searched ? (
        <p className="text-muted-foreground text-center py-16">
          Search for stories, writers, and topics across IndieStack.
        </p>
      ) : loading ? (
        <div className="flex items-center justify-center gap-2 text-muted-foreground py-16">
          <Loader2 className="h-5 w-5 animate-spin" /> Searching...
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                    active
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  <span className="text-xs text-muted-foreground">{counts[tab.key]}</span>
                </button>
              );
            })}
          </div>

          {/* Stories */}
          {activeTab === "stories" && (
            <div className="space-y-1">
              {data?.stories.length ? (
                data.stories.map((r) => (
                  <Link
                    key={r.id}
                    href={`/@${r.author_username}/${r.slug}`}
                    className="block border-b border-border py-4 hover:bg-muted/40 rounded-md px-3 -mx-3 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={r.author_avatar} alt={r.author_name} />
                        <AvatarFallback>{getInitials(r.author_name)}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground">{r.author_name}</span>
                    </div>
                    <h3 className="font-semibold text-lg">{r.title}</h3>
                    {r.excerpt && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{r.excerpt}</p>
                    )}
                  </Link>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-12">No stories found.</p>
              )}
            </div>
          )}

          {/* People */}
          {activeTab === "people" && (
            <div className="space-y-1">
              {data?.people.length ? (
                data.people.map((p) => (
                  <Link
                    key={p.id}
                    href={`/@${p.username}`}
                    className="flex items-center gap-3 border-b border-border py-4 hover:bg-muted/40 rounded-md px-3 -mx-3 transition-colors"
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={p.avatar_url} alt={p.display_name} />
                      <AvatarFallback>{getInitials(p.display_name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold">{p.display_name}</span>
                        {p.is_verified && <span className="text-primary text-xs">✓</span>}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        @{p.username} · {p.follower_count} followers
                      </p>
                      {p.bio && (
                        <p className="text-sm text-muted-foreground line-clamp-1">{p.bio}</p>
                      )}
                    </div>
                  </Link>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-12">No people found.</p>
              )}
            </div>
          )}

          {/* Topics */}
          {activeTab === "topics" && (
            <div className="space-y-1">
              {data?.topics.length ? (
                data.topics.map((t) => (
                  <Link
                    key={t.tag}
                    href={`/discover?tag=${encodeURIComponent(t.tag)}`}
                    className="flex items-center justify-between border-b border-border py-4 hover:bg-muted/40 rounded-md px-3 -mx-3 transition-colors"
                  >
                    <span className="font-semibold">#{t.tag}</span>
                    <span className="text-sm text-muted-foreground">{t.count} stories</span>
                  </Link>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-12">No topics found.</p>
              )}
            </div>
          )}

          {/* Publications */}
          {activeTab === "publications" && (
            <div className="space-y-1">
              {data?.publications.length ? (
                data.publications.map((p) => (
                  <Link
                    key={p.id}
                    href={`/publications/${p.slug}`}
                    className="flex items-center gap-3 border-b border-border py-4 hover:bg-muted/40 rounded-md px-3 -mx-3 transition-colors"
                  >
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                      {p.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.logo_url} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <BookOpen className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold">{p.name}</span>
                      {p.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">{p.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {p.follower_count} followers · {p.post_count} stories
                      </p>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-12">No publications found.</p>
              )}
            </div>
          )}

          {/* Lists */}
          {activeTab === "lists" && (
            <div className="space-y-1">
              {data?.lists.length ? (
                data.lists.map((l) => (
                  <Link
                    key={l.id}
                    href={`/lists/${l.id}`}
                    className="flex items-center gap-3 border-b border-border py-4 hover:bg-muted/40 rounded-md px-3 -mx-3 transition-colors"
                  >
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <List className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold">{l.name}</span>
                      {l.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">{l.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {l.item_count} stories · by {l.owner_name}
                      </p>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-12">No lists found.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
