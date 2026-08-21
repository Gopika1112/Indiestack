"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { publicationsAPI, Publication } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Plus, Users, FileText } from "lucide-react";

export default function PublicationsPage() {
  const { isAuthenticated } = useAuthStore();
  const [publications, setPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    publicationsAPI
      .list()
      .then((res) => setPublications(res.data || []))
      .catch(() => setPublications([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="container mx-auto px-4 py-8 max-w-[780px] flex-1">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Publications</h1>
            <p className="text-muted-foreground mt-1">
              Multi-author magazines where writers publish together.
            </p>
          </div>
          {isAuthenticated && (
            <Link href="/publications/new">
              <Button className="rounded-full">
                <Plus className="mr-2 h-4 w-4" />
                New publication
              </Button>
            </Link>
          )}
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : publications.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No publications yet.</p>
            {isAuthenticated && (
              <Link href="/publications/new">
                <Button variant="outline" className="rounded-full">
                  Create the first publication
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {publications.map((pub) => (
              <Link
                key={pub.id}
                href={`/publications/${pub.slug}`}
                className="block border rounded-lg p-5 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                    {pub.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pub.logo_url} alt={pub.name} className="h-full w-full object-cover" />
                    ) : (
                      <BookOpen className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold">{pub.name}</h2>
                    {pub.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{pub.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1.5">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {pub.follower_count} followers
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" />
                        {pub.post_count} stories
                      </span>
                    </div>
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
