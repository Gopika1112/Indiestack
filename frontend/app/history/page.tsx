"use client";
import { useState, useEffect } from "react";
export default function HistoryPage() {
  const [history, setHistory] = useState<any[]>([]);
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) fetch("/api/v1/history", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(d => setHistory(d.data || []));
  }, []);
  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Reading History</h1>
      <div className="space-y-4">
        {history.map((h: any) => (
          <a key={h.id} href={`/article/${h.slug}`} className="block border rounded-lg p-4 hover:shadow-md">
            <h3 className="font-semibold">{h.title}</h3>
            <p className="text-sm text-muted-foreground">Read on {new Date(h.read_at).toLocaleDateString()}</p>
          </a>
        ))}
        {history.length === 0 && <p className="text-muted-foreground">No reading history yet.</p>}
      </div>
    </div>
  );
}
