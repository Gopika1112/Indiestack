"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingPostsRail } from "@/components/feed/trending-posts-rail";
import { TrendingTopicsRail } from "@/components/feed/trending-topics-rail";

// AppRails renders a single right rail with trending topics on top and trending
// posts (trending-now) below it — like Medium's right sidebar. It's hidden on
// post-specific pages (/@user/slug) where the post page shows its own related
// posts rail instead.
export function AppRails() {
  const pathname = usePathname();

  // Hide the universal rails on post-specific pages, settings pages, and the docs
  // page (docs has its own left navigation panel; rails would overlap/clutter it).
  if (isPostPath(pathname)) return null;
  if (pathname === "/settings" || pathname.startsWith("/settings/")) return null;
  if (pathname === "/docs" || pathname.startsWith("/docs/")) return null;

  const isFeedPage = pathname === "/feed" || pathname === "/";

  return (
    <aside className="hidden xl:flex xl:flex-col xl:fixed xl:top-20 xl:right-6 xl:w-[280px] xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto">
      {/* Trending topics */}
      <TrendingTopicsRail />

      {/* Trending now (posts) — below topics */}
      <div className="mt-8 pt-6 border-t border-border">
        <TrendingPostsRail />
      </div>

      {/* Footer links on the feed page */}
      {isFeedPage && (
        <nav className="mt-8 pt-6 border-t border-border flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <Link href="/about" className="hover:text-foreground">About</Link>
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/help" className="hover:text-foreground">Help</Link>
        </nav>
      )}
    </aside>
  );
}

// Reserved top-level routes that are NOT post pages even though they may have
// a second segment.
const NON_POST_PREFIXES = [
  "/feed", "/discover", "/explore", "/search", "/bookmarks", "/history",
  "/notifications", "/settings", "/dashboard", "/write", "/jobs", "/about",
  "/pricing", "/help", "/terms", "/privacy", "/docs", "/login", "/register",
  "/profile", "/writer", "/article",
];

function isPostPath(pathname: string): boolean {
  if (!pathname) return false;
  const parts = pathname.replace(/^\/+/, "").split("/").filter(Boolean);
  if (parts.length !== 2) return false;
  const first = parts[0];
  const firstClean = first.startsWith("@") ? first.slice(1) : first;
  return !NON_POST_PREFIXES.some(
    (p) => "/" + firstClean === p || "/" + first === p
  );
}
