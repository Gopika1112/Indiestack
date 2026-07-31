"use client";

import { useEffect, useState } from "react";
import { feedAPI, Post } from "@/lib/api";
import { PostCard } from "@/components/feed/post-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Search, Flame } from "lucide-react";

const TOPICS = [
  "Technology",
  "Programming",
  "Design",
  "Writing",
  "Science",
  "Productivity",
  "Startups",
  "AI",
] as const;

export default function DiscoverPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const response = await feedAPI.getTrending({ limit: 50 });
      if (response.success && response.data) {
        setPosts(response.data);
      }
    } catch (error) {
      console.error("Failed to load posts:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPosts = posts.filter(
    (post) =>
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.author_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto px-4 py-6 max-w-[680px]">
      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search stories, topics, or writers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 rounded-full bg-muted border-none focus-visible:ring-1"
        />
      </div>

      {/* Topic chips */}
      <div className="flex flex-wrap gap-2 mb-8">
        {TOPICS.map((topic) => (
          <button
            key={topic}
            onClick={() => setSelectedTopic(selectedTopic === topic ? null : topic)}
            className={`px-3.5 py-1.5 text-sm rounded-full border transition-colors ${selectedTopic === topic
              ? "bg-foreground text-background border-foreground"
              : "bg-transparent text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
              }`}
          >
            {topic}
          </button>
        ))}
      </div>

      {/* Trending header */}
      <div className="flex items-center gap-2 mb-4">
        <Flame className="h-5 w-5 text-orange-500" />
        <h2 className="text-lg font-semibold">Trending on IndieStack</h2>
      </div>

      {loading ? (
        <div className="space-y-0">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="py-6 border-b border-border space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      ) : filteredPosts.length > 0 ? (
        <div>
          {filteredPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-muted-foreground">
            {searchQuery
              ? "No stories found matching your search."
              : "No stories yet. Check back later!"}
          </p>
        </div>
      )}
    </div>
  );
}
