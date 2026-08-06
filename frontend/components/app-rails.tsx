"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebarStore } from "@/lib/sidebar-store";
import { TrendingPostsRail } from "@/components/feed/trending-posts-rail";
import { TrendingTopicsRail } from "@/components/feed/trending-topics-rail";

// AppRails renders the universal left (trending-now) and right (trending-topics)
// rails on every page EXCEPT post-specific pages (/@user/slug), where the post page
// shows its own related-posts rail instead. On the feed page the right rail also
// shows Medium-style footer links (About/Terms/Privacy/Help).
//
// Rails are offset past the fixed app sidebar (260px expanded / 72px collapsed) so
// they are never hidden behind it.
export function AppRails() {
  const pathname = usePathname();
  const { collapsed } = useSidebarStore();

  const isPostPage = isPostPath(pathname);
  if (isPostPage) return null;

  const isFeedPage = pathname === "/feed" || pathname === "/";
  const leftOffset = collapsed ? "xl:left-[88px]" : "xl:left-[276px]";

  return (
    <>
      {/* Left rail: trending posts (trending-now) */}
      <aside className={`hidden xl:block xl:fixed xl:top-24 xl:w-[240px] ${leftOffset}`}>
        <TrendingPostsRail />
      </aside>

      {/* Right rail: trending topics (+ footer links on the feed page) */}
      <aside className="hidden xl:flex xl:flex-col xl:fixed xl:top-24 xl:right-6 xl:w-[280px] xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto">
        <TrendingTopicsRail />
        {isFeedPage && (
          <nav className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <Link href="/about" className="hover:text-foreground">About</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/help" className="hover:text-foreground">Help</Link>
          </nav>
        )}
      </aside>
    </>
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
