"use client";
import { useState, useEffect } from "react";
export default function NewsletterPage() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    fetch("/api/v1/newsletter").then(r => r.json()).then(d => setCount(d.data?.subscriber_count || 0));
  }, []);
  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">Newsletter</h1>
      <p className="text-muted-foreground mb-8">Manage your newsletter and reach your subscribers.</p>
      <div className="border rounded-lg p-6 text-center">
        <div className="text-4xl font-bold">{count}</div>
        <div className="text-muted-foreground">Total Subscribers</div>
      </div>
    </div>
  );
}
