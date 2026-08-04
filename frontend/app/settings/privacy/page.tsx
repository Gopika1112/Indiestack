"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/components/toast-provider";
import { settingsAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { SettingsSection, PrefRow } from "@/components/settings/controls";
import { Loader2, Download, Trash2 } from "lucide-react";

const PRIVACY_OPTS = [
  { key: "private_account", label: "Private Account", desc: "Only approved followers can see your stories" },
  { key: "show_reading_history", label: "Show Reading History", desc: "Let others see what you've read" },
  { key: "allow_search_indexing", label: "Allow Search Engines to Index Profile", desc: "Your profile can appear in search results" },
  { key: "show_followers_count", label: "Show Followers Count", desc: "Display your follower count publicly" },
  { key: "show_following_count", label: "Show Following Count", desc: "Display your following count publicly" },
  { key: "allow_direct_messages", label: "Allow Direct Messages", desc: "Let other members message you" },
];

export default function PrivacyPage() {
  const router = useRouter();
  const { logout } = useAuthStore();
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    settingsAPI.getPrivacy()
      .then((res) => {
        const d = (res.data || {}) as Record<string, boolean>;
        const init: Record<string, boolean> = {};
        PRIVACY_OPTS.forEach((o) => {
          init[o.key] = d[o.key] === undefined ? (o.key !== "private_account") : Boolean(d[o.key]);
        });
        setPrefs(init);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = (key: string) => setPrefs((p) => ({ ...p, [key]: !p[key] }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsAPI.updatePrivacy(prefs);
      toast({ title: "Privacy settings saved", variant: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Save failed", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await settingsAPI.exportData();
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "indiestack-data.json";
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Data downloaded", variant: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Download failed", variant: "error" });
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Permanently delete your account? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await settingsAPI.deleteAccount();
      toast({ title: "Account deleted", variant: "success" });
      logout();
      router.push("/");
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Delete failed", variant: "error" });
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <SettingsSection title="Privacy" description="Control your visibility and data.">
        <div className="divide-y divide-border/60">
          {PRIVACY_OPTS.map((o) => (
            <PrefRow key={o.key} title={o.label} description={o.desc} checked={!!prefs[o.key]} onChange={() => toggle(o.key)} />
          ))}
        </div>
        <div className="mt-4">
          <Button onClick={handleSave} disabled={saving} className="rounded-full px-6">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save privacy settings
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection title="Your Data" description="Download a copy of your personal data.">
        <Button onClick={handleDownload} disabled={downloading} variant="outline" className="rounded-full px-6">
          {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Download personal data
        </Button>
      </SettingsSection>

      <SettingsSection title="Delete Account" description="Permanently remove your account and all content." danger>
        <Button onClick={handleDelete} disabled={deleting} variant="destructive" className="rounded-full px-6">
          {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
          Delete account
        </Button>
      </SettingsSection>
    </div>
  );
}
