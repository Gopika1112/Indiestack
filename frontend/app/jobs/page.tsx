"use client";
import { useState, useEffect } from "react";
export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  useEffect(() => {
    fetch("/api/v1/jobs").then(r => r.json()).then(d => setJobs(d.data || []));
  }, []);
  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-2">Job Board</h1>
      <p className="text-muted-foreground mb-8">Find your next opportunity in tech.</p>
      <div className="space-y-4">
        {jobs.map((j: any) => (
          <div key={j.id} className="border rounded-lg p-6 hover:shadow-md transition-shadow">
            <h3 className="text-xl font-semibold">{j.title}</h3>
            <p className="text-muted-foreground">{j.company_name} · {j.location || "Remote"} · {j.work_mode}</p>
            <div className="flex gap-2 mt-2">
              <span className="text-xs bg-muted px-2 py-1 rounded">{j.job_type}</span>
              {j.salary_min && <span className="text-xs bg-muted px-2 py-1 rounded">₹{j.salary_min / 1000}k - ₹{j.salary_max / 1000}k</span>}
            </div>
          </div>
        ))}
        {jobs.length === 0 && <p className="text-muted-foreground">No open positions yet.</p>}
      </div>
    </div>
  );
}
