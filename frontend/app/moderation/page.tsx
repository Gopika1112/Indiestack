"use client";

import { useEffect, useState } from "react";
import { reportsAPI, Report } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/components/toast-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Flag, CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function ModerationPage() {
  const { isAuthenticated } = useAuthStore();
  const { toast } = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "reviewed" | "resolved" | "dismissed">("pending");
  const [updating, setUpdating] = useState<string | null>(null);

  const loadReports = async () => {
    setLoading(true);
    try {
      const res = await reportsAPI.list(filter);
      setReports(res.data || []);
    } catch (err) {
      console.error("Failed to load reports:", err);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [filter]);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    try {
      await reportsAPI.update(id, status);
      toast({ title: `Report marked as ${status}`, variant: "success" });
      await loadReports();
    } catch (err) {
      console.error("Update report failed:", err);
      toast({ title: "Couldn't update report", variant: "error" });
    } finally {
      setUpdating(null);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <main className="container mx-auto px-4 py-8 max-w-[780px] flex-1">
          <div className="text-center py-16">
            <Flag className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground">Sign in to view moderation reports.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="container mx-auto px-4 py-8 max-w-[780px] flex-1">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Moderation</h1>
          <p className="text-muted-foreground mt-1">
            Review and manage content reports.
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-0 border-b border-border mb-6">
          {(["pending", "reviewed", "resolved", "dismissed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-3 text-sm font-medium transition-colors relative capitalize ${
                filter === s ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}
              {filter === s && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-16">
            <Flag className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground">No {filter} reports.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div key={report.id} className="border rounded-lg p-5 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                        report.reason === "spam" ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" :
                        report.reason === "abuse" ? "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200" :
                        "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200"
                      }`}>
                        <Flag className="h-3 w-3" />
                        {report.reason}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        by @{report.reporter_username}
                      </span>
                    </div>
                    {report.post_title && (
                      <h3 className="font-semibold text-lg mb-1">{report.post_title}</h3>
                    )}
                    {report.comment_body && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-1">{report.comment_body}</p>
                    )}
                    {report.details && (
                      <p className="text-sm text-muted-foreground">{report.details}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Reported {new Date(report.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateStatus(report.id, "resolved")}
                      disabled={updating === report.id}
                      className="rounded-full text-green-600 hover:text-green-700"
                    >
                      {updating === report.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Resolve
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateStatus(report.id, "dismissed")}
                      disabled={updating === report.id}
                      className="rounded-full text-muted-foreground hover:text-foreground"
                    >
                      {updating === report.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 mr-1" />
                          Dismiss
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
