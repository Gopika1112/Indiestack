"use client";
import { useState, useEffect } from "react";
export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<any[]>([]);
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) fetch("/api/v1/notifications", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(d => setNotifs(d.data || []));
  }, []);
  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Notifications</h1>
      <div className="space-y-3">
        {notifs.map((n: any) => (
          <div key={n.id} className={`border rounded-lg p-4 ${n.read ? "opacity-60" : ""}`}>
            <div className="font-semibold">{n.title}</div>
            <div className="text-sm text-muted-foreground">{n.body}</div>
          </div>
        ))}
        {notifs.length === 0 && <p className="text-muted-foreground">No notifications yet.</p>}
      </div>
    </div>
  );
}
