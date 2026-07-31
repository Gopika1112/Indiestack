"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { feedAPI, Post } from "@/lib/api";
import { PostCard } from "@/components/feed/post-card";
import { Footer } from "@/components/footer";
import { Skeleton } from "@/components/ui/skeleton";
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

  useEffect(() => {
    const loadPosts = async () => {
      setLoading(true);
      try {
        let response;
        if (activeTab === "for-you") {
          response = await feedAPI.getFeed({ limit: 20 });
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
  }, [activeTab]);

  return (
    <div className="flex flex-col min-h-screen">
      <div className="container mx-auto px-4 py-6 max-w-[680px] flex-1 w-full">
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
              <PostCard key={post.id} post={post} />
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

      <Footer />
    </div>
  );
}
