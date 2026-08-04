"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/toast-provider";
import { settingsAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { SettingsSection, PrefRow } from "@/components/settings/controls";
import { Loader2 } from "lucide-react";

const EMAIL_OPTS = [
  { key: "email_new_follower", label: "New follower", desc: "When someone follows you" },
  { key: "email_new_comment", label: "New comment", desc: "When someone comments on your story" },
  { key: "email_story_featured", label: "Story featured", desc: "When your story is featured" },
  { key: "email_weekly_digest", label: "Weekly digest", desc: "A weekly summary of activity" },
  { key: "email_product_updates", label: "Product updates", desc: "News about new features" },
];

const PUSH_OPTS = [
  { key: "push_comments", label: "Comments", desc: "When someone comments" },
  { key: "push_mentions", label: "Mentions", desc: "When someone mentions you" },
  { key: "push_new_followers", label: "New followers", desc: "When you gain a follower" },
  { key: "push_replies", label: "Replies", desc: "When someone replies to you" },
];

export default function NotificationsPage() {
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsAPI.getNotifications()
      .then((res) => {
        const d = (res.data || {}) as Record<string, boolean>;
        const init: Record<string, boolean> = {};
        [...EMAIL_OPTS, ...PUSH_OPTS].forEach((o) => { init[o.key] = d[o.key] !== false && d[o.key] !== undefined ? Boolean(d[o.key]) : true; });
        setPrefs(init);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = (key: string) => setPrefs((p) => ({ ...p, [key]: !p[key] }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsAPI.updateNotifications(prefs);
      toast({ title: "Notification preferences saved", variant: "success" });
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
      <SettingsSection title="Email Notifications" description="Choose what we email you about.">
        <div className="divide-y divide-border/60">
          {EMAIL_OPTS.map((o) => (
            <PrefRow key={o.key} title={o.label} description={o.desc} checked={!!prefs[o.key]} onChange={() => toggle(o.key)} />
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Push Notifications" description="Choose what push notifications you receive.">
        <div className="divide-y divide-border/60">
          {PUSH_OPTS.map((o) => (
            <PrefRow key={o.key} title={o.label} description={o.desc} checked={!!prefs[o.key]} onChange={() => toggle(o.key)} />
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
