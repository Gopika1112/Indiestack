"use client";
import { useState, useEffect } from "react";
export default function DraftsPage() {
  const [drafts, setDrafts] = useState<any[]>([]);
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) fetch("/api/v1/posts/mine", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(d => setDrafts((d.data || []).filter((p: any) => p.status === "draft")));
  }, []);
  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">Drafts</h1>
      <div className="space-y-4">
        {drafts.map((d: any) => (
          <div key={d.id} className="border rounded-lg p-4">
            <h3 className="font-semibold">{d.title}</h3>
            <p className="text-sm text-muted-foreground">{d.excerpt}</p>
          </div>
        ))}
        {drafts.length === 0 && <p className="text-muted-foreground">No drafts yet.</p>}
      </div>
    </div>
  );
}
