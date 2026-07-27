"use client";
import { useState, useEffect } from "react";
export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) fetch("/api/v1/auth/me", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(d => setUser(d.data));
  }, []);
  if (!user) return <div className="max-w-3xl mx-auto p-8"><p>Loading...</p></div>;
  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">Profile</h1>
      <div className="border rounded-lg p-6 space-y-4">
        <div><span className="font-semibold">Name:</span> {user.display_name}</div>
        <div><span className="font-semibold">Username:</span> @{user.username}</div>
        <div><span className="font-semibold">Email:</span> {user.email}</div>
        <div><span className="font-semibold">Bio:</span> {user.bio || "Not set"}</div>
        <div><span className="font-semibold">Followers:</span> {user.follower_count}</div>
      </div>
    </div>
  );
}
