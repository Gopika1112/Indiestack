"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { feedAPI, Post } from "@/lib/api";
import { PostCard } from "@/components/feed/post-card";
import { Footer } from "@/components/footer";
import { Skeleton } from "@/components/ui/skeleton";
import { useBookmarkedIds } from "@/lib/use-bookmarks";
import { useSidebarStore } from "@/lib/sidebar-store";
import { useAuthStore } from "@/lib/auth-store";
import { TrendingPostsRail } from "@/components/feed/trending-posts-rail";
import { TrendingTopicsRail } from "@/components/feed/trending-topics-rail";
import { PenLine, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

const TABS = [
  { key: "for-you", label: "For You" },
  { key: "trending", label: "Trending" },
  { key: "latest", label: "Latest" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("for-you");
  const bookmarkedIds = useBookmarkedIds();
  const { collapsed } = useSidebarStore();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    const loadPosts = async () => {
      setLoading(true);
      try {
        let response;
        if (activeTab === "for-you") {
          // "For You" shows posts from followed topics (falls back to all posts
          // when the user follows nothing or there's no match).
          response = isAuthenticated
            ? await feedAPI.getFollowingTopicsFeed()
            : await feedAPI.getFeed({ limit: 20 });
        } else if (activeTab === "trending") {
          response = await feedAPI.getTrending({ limit: 20 });
        } else {
          response = await feedAPI.getLatest({ limit: 20 });
        }

        if (response.success && response.data) {
          setPosts(response.data);
        }
      } catch (error) {
        console.error("Failed to load feed:", error);
      } finally {
        setLoading(false);
      }
    };

    loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isAuthenticated]);

  return (
    <div className="flex flex-col min-h-screen">
      <div className="container mx-auto px-4 py-6 max-w-[1200px] flex-1 w-full">
        <div className="xl:flex xl:gap-10">
          {/* Left rail: trending posts — only when the app sidebar is collapsed,
              so it fills the freed-up left whitespace without cluttering. */}
          {collapsed && (
            <aside className="hidden xl:block xl:w-[260px] xl:shrink-0">
              <div className="xl:sticky xl:top-6 border-r border-border xl:pr-6">
                <TrendingPostsRail />
              </div>
            </aside>
          )}

          {/* Center column: the feed */}
          <div className="flex-1 min-w-0 max-w-[680px] mx-auto xl:mx-0 w-full">
        {/* Underline Tabs */}
        <div className="flex gap-0 border-b border-border mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium transition-colors relative ${activeTab === tab.key
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />
              )}
            </button>
          ))}
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
        ) : posts.length > 0 ? (
          <div>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} initialSaved={bookmarkedIds.has(post.id)} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <Compass className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Your feed is empty</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              Follow writers and topics you love to see their latest stories here.
            </p>
            <div className="flex gap-3 justify-center">
              <Link href="/discover">
                <Button variant="outline" className="rounded-full">
                  <Compass className="mr-2 h-4 w-4" />
                  Explore writers
                </Button>
              </Link>
              <Link href="/write">
                <Button className="rounded-full">
                  <PenLine className="mr-2 h-4 w-4" />
                  Write a story
                </Button>
              </Link>
            </div>
          </div>
        )}
          </div>

          {/* Right rail: trending topics (always visible on desktop) */}
          <aside className="hidden xl:block xl:w-[280px] xl:shrink-0">
            <div className="xl:sticky xl:top-6 border-l border-border xl:pl-6">
              <TrendingTopicsRail />
            </div>
          </aside>
        </div>
      </div>

      <Footer />
    </div>
  );
}
