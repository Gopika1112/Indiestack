"use client";
import { useState, useEffect } from "react";
export default function EarningsPage() {
  const [earnings, setEarnings] = useState<any>({});
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) fetch("/api/v1/earnings", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(d => setEarnings(d.data || {}));
  }, []);
  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">Earnings</h1>
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-6 text-center"><div className="text-2xl font-bold">${earnings.tips_total || 0}</div><div className="text-sm text-muted-foreground">Tips</div></div>
        <div className="border rounded-lg p-6 text-center"><div className="text-2xl font-bold">${earnings.subscriptions_total || 0}</div><div className="text-sm text-muted-foreground">Subscriptions</div></div>
        <div className="border rounded-lg p-6 text-center"><div className="text-2xl font-bold">${earnings.total || 0}</div><div className="text-sm text-muted-foreground">Total</div></div>
      </div>
    </div>
  );
}
