"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/toast-provider";
import { settingsAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsSection, Field, Select, PrefRow } from "@/components/settings/controls";
import { Loader2 } from "lucide-react";

const FONT_OPTS = [
  { value: "sans", label: "Sans (Default)" },
  { value: "serif", label: "Serif" },
  { value: "mono", label: "Monospace" },
];
const SIZE_OPTS = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];
const WIDTH_OPTS = [
  { value: "narrow", label: "Narrow" },
  { value: "medium", label: "Medium" },
  { value: "wide", label: "Wide" },
];
const HEIGHT_OPTS = [
  { value: "compact", label: "Compact" },
  { value: "normal", label: "Normal" },
  { value: "relaxed", label: "Relaxed" },
];

export default function WritingPage() {
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<Record<string, string | boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsAPI.getWriting()
      .then((res) => setPrefs((res.data || {}) as Record<string, string | boolean>))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = (key: string, val: string | boolean) => setPrefs((p) => ({ ...p, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsAPI.updateWriting(prefs as Record<string, string>);
      toast({ title: "Writing preferences saved", variant: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Save failed", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const str = (k: string, d: string) => (typeof prefs[k] === "string" ? (prefs[k] as string) : d);
  const bool = (k: string, d: boolean) => (typeof prefs[k] === "boolean" ? (prefs[k] as boolean) : d);

  return (
    <div className="space-y-6">
      <SettingsSection title="Editor" description="Customize your writing experience.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="Default Font"><Select value={str("editor_font", "sans")} onChange={(v) => set("editor_font", v)} options={FONT_OPTS} /></Field>
          <Field label="Font Size"><Select value={str("font_size", "medium")} onChange={(v) => set("font_size", v)} options={SIZE_OPTS} /></Field>
          <Field label="Editor Width"><Select value={str("editor_width", "medium")} onChange={(v) => set("editor_width", v)} options={WIDTH_OPTS} /></Field>
          <Field label="Line Height"><Select value={str("line_height", "normal")} onChange={(v) => set("line_height", v)} options={HEIGHT_OPTS} /></Field>
        </div>
        <div className="divide-y divide-border/60 mt-4">
          <PrefRow title="Dark Mode Editor" description="Use a dark editor canvas" checked={bool("dark_mode_editor", false)} onChange={(v) => set("dark_mode_editor", v)} />
          <PrefRow title="Spell Check" description="Underline misspelled words" checked={bool("spell_check", true)} onChange={(v) => set("spell_check", v)} />
          <PrefRow title="Auto Save" description="Automatically save drafts as you write" checked={bool("auto_save", true)} onChange={(v) => set("auto_save", v)} />
        </div>
      </SettingsSection>

      <SettingsSection title="Publishing" description="Defaults applied to new stories.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="Default Visibility">
            <Select value={str("default_visibility", "public")} onChange={(v) => set("default_visibility", v)}
              options={[{ value: "public", label: "Public" }, { value: "unlisted", label: "Unlisted" }, { value: "private", label: "Private" }]} />
          </Field>
          <Field label="Canonical URL" hint="Optional canonical link for SEO.">
            <Input value={str("canonical_url", "")} onChange={(e) => set("canonical_url", e.target.value)} placeholder="https://" />
          </Field>
        </div>
        <div className="divide-y divide-border/60 mt-4">
          <PrefRow title="Enable Comments" description="Allow readers to comment on your stories" checked={bool("enable_comments", true)} onChange={(v) => set("enable_comments", v)} />
          <PrefRow title="Show Reading Time" description="Display estimated reading time" checked={bool("show_reading_time", true)} onChange={(v) => set("show_reading_time", v)} />
          <PrefRow title="Show Table of Contents" description="Auto-generate a TOC from headings" checked={bool("show_table_of_contents", false)} onChange={(v) => set("show_table_of_contents", v)} />
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
