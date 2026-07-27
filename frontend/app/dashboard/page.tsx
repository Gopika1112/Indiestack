"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function DashboardPage() {
  const [stats, setStats] = useState<any>({});
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) fetch("/api/v1/stats", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(d => setStats(d.data || {}));
  }, []);
  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[["Posts", stats.posts], ["Views", stats.views], ["Likes", stats.likes], ["Followers", stats.followers]].map(([label, val]) => (
          <div key={label as string} className="border rounded-lg p-6 text-center">
            <div className="text-3xl font-bold">{val || 0}</div>
            <div className="text-sm text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[["Newsletter", "/dashboard/newsletter"], ["Subscribers", "/dashboard/subscribers"], ["Earnings", "/dashboard/earnings"], ["Drafts", "/dashboard/drafts"]].map(([label, href]) => (
          <Link key={label as string} href={href as string} className="border rounded-lg p-4 text-center hover:shadow-md transition-shadow">
            <div className="font-semibold">{label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
