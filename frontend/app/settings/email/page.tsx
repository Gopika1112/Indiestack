"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/toast-provider";
import { settingsAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { SettingsSection, Field, PrefRow } from "@/components/settings/controls";
import { Loader2 } from "lucide-react";

const FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "never", label: "Never" },
];

const SUBSCRIPTIONS = [
  { key: "newsletters", label: "Newsletters", desc: "Stories from writers you follow" },
  { key: "product_updates", label: "Product Updates", desc: "New features and improvements" },
  { key: "writer_recommendations", label: "Writer Recommendations", desc: "Writers you might like" },
  { key: "trending_stories", label: "Trending Stories", desc: "Popular stories on IndieStack" },
];

export default function EmailPage() {
  const { toast } = useToast();
  const [frequency, setFrequency] = useState("weekly");
  const [subs, setSubs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsAPI.getEmail()
      .then((res) => {
        const d = (res.data || {}) as Record<string, string | boolean>;
        if (typeof d.frequency === "string" && d.frequency) setFrequency(d.frequency);
        const init: Record<string, boolean> = {};
        SUBSCRIPTIONS.forEach((s) => { init[s.key] = d[s.key] === undefined ? true : Boolean(d[s.key]); });
        setSubs(init);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = (key: string) => setSubs((p) => ({ ...p, [key]: !p[key] }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsAPI.updateEmail({ frequency, ...subs } as Record<string, string>);
      toast({ title: "Email preferences saved", variant: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Save failed", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <SettingsSection title="Email Frequency" description="How often should we email you?">
        <Field label="Frequency">
          <div className="flex flex-wrap gap-2">
            {FREQUENCIES.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFrequency(f.value)}
                className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                  frequency === f.value
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </Field>
      </SettingsSection>

      <SettingsSection title="Subscriptions" description="Choose which emails you receive.">
        <div className="divide-y divide-border/60">
          {SUBSCRIPTIONS.map((s) => (
            <PrefRow key={s.key} title={s.label} description={s.desc} checked={!!subs[s.key]} onChange={() => toggle(s.key)} />
          ))}
        </div>
      </SettingsSection>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="rounded-full px-6">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save preferences
        </Button>
      </div>
    </div>
  );
}
