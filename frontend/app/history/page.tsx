"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { historyAPI, HistoryItem } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock } from "lucide-react";

export default function HistoryPage() {
  const { isAuthenticated } = useAuthStore();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    historyAPI
      .list()
      .then((res) => setHistory(res.data || []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-[680px]">
      <h1 className="text-3xl font-bold mb-6">Reading History</h1>

      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="border-b border-border py-4 space-y-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      ) : !isAuthenticated ? (
        <p className="text-muted-foreground">Sign in to see your reading history.</p>
      ) : history.length > 0 ? (
        <div>
          {history.map((h) => (
            <Link
              key={h.id}
              href={`/@${h.author_username}/${h.slug}`}
              className="block border-b border-border py-4 hover:bg-muted/40 rounded-md px-3 -mx-3 transition-colors"
            >
              <h3 className="font-semibold text-lg">{h.title}</h3>
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Read on {new Date(h.read_at).toLocaleString()}
                {h.author_username && <span> · by @{h.author_username}</span>}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-center py-16">
          No reading history yet. Stories you read will appear here.
        </p>
      )}
    </div>
  );
}
