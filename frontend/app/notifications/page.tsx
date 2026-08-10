"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { notificationsAPI, NotificationItem } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeDate } from "@/lib/utils";
import { Heart, MessageCircle, Repeat2, UserPlus, AtSign, Bell, Loader2 } from "lucide-react";

const TYPE_ICON: Record<string, React.ReactNode> = {
  like: <Heart className="h-4 w-4 text-red-500" />,
  comment: <MessageCircle className="h-4 w-4 text-blue-500" />,
  repost: <Repeat2 className="h-4 w-4 text-green-600" />,
  follow: <UserPlus className="h-4 w-4 text-purple-500" />,
  mention: <AtSign className="h-4 w-4 text-amber-500" />,
};

export default function NotificationsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    notificationsAPI
      .list()
      .then((res) => setNotifs(res.data || []))
      .catch(() => setNotifs([]))
      .finally(() => setLoading(false));
  }, [isAuthenticated, authLoading]);

  const markAllRead = async () => {
    setMarking(true);
    try {
      await notificationsAPI.markAllRead();
      setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // non-fatal
    } finally {
      setMarking(false);
    }
  };

  const unread = notifs.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 max-w-[680px]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Notifications</h1>
            {unread > 0 && (
              <p className="text-sm text-muted-foreground mt-1">{unread} unread</p>
            )}
          </div>
          {unread > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead} disabled={marking} className="rounded-full">
              {marking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mark all read"}
            </Button>
          )}
        </div>

        {loading || authLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : !isAuthenticated ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-4">Sign in to see your notifications.</p>
            <Link href="/login">
              <Button variant="outline" className="rounded-full">Sign in</Button>
            </Link>
          </div>
        ) : notifs.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">No notifications yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifs.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 border rounded-lg p-4 transition-colors ${
                  n.read ? "opacity-60" : "bg-muted/40"
                }`}
              >
                <div className="mt-0.5 shrink-0">{TYPE_ICON[n.type] || <Bell className="h-4 w-4" />}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm">{n.title}</div>
                  {n.body && <div className="text-sm text-muted-foreground line-clamp-1">{n.body}</div>}
                  <div className="text-xs text-muted-foreground mt-1">{formatRelativeDate(n.created_at)}</div>
                </div>
                {!n.read && <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
