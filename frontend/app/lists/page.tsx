"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listsAPI, ReadingList } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { List, Plus, Lock, Globe } from "lucide-react";

export default function ListsPage() {
  const { isAuthenticated } = useAuthStore();
  const [lists, setLists] = useState<ReadingList[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listsAPI
      .list()
      .then((res) => setLists(res.data || []))
      .catch(() => setLists([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="container mx-auto px-4 py-8 max-w-[780px] flex-1">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Lists</h1>
            <p className="text-muted-foreground mt-1">
              Curated collections of stories from the community.
            </p>
          </div>
          {isAuthenticated && (
            <Link href="/lists/new">
              <Button className="rounded-full">
                <Plus className="mr-2 h-4 w-4" />
                New list
              </Button>
            </Link>
          )}
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : lists.length === 0 ? (
          <div className="text-center py-16">
            <List className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No public lists yet.</p>
            {isAuthenticated && (
              <Link href="/lists/new">
                <Button variant="outline" className="rounded-full">
                  Create the first list
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {lists.map((list) => (
              <Link
                key={list.id}
                href={`/lists/${list.id}`}
                className="block border rounded-lg p-5 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <List className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold">{list.name}</h2>
                      {list.is_public ? (
                        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </div>
                    {list.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{list.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {list.item_count} stories · by {list.owner_name}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
