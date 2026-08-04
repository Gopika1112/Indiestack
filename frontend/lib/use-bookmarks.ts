"use client";

import { useEffect, useState } from "react";
import { bookmarksAPI, Bookmark } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

// useBookmarkedIds fetches the current user's bookmarked post IDs once and
// returns them as a Set for O(1) lookup, so feed cards can render the correct
// saved state on first paint (and after a refresh).
export function useBookmarkedIds(): Set<string> {
  const { isAuthenticated } = useAuthStore();
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isAuthenticated) {
      setIds(new Set());
      return;
    }
    let cancelled = false;
    bookmarksAPI
      .list()
      .then((res) => {
        if (cancelled) return;
        const set = new Set<string>();
        (res.data || []).forEach((b: Bookmark) => {
          if (b.post_id) set.add(b.post_id);
        });
        setIds(set);
      })
      .catch(() => {
        if (!cancelled) setIds(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  return ids;
}
