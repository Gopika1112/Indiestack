"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useToast } from "@/components/toast-provider";
import { settingsAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
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
const SPACING_OPTS = [
  { value: "compact", label: "Compact" },
  { value: "normal", label: "Normal" },
  { value: "relaxed", label: "Relaxed" },
];
const HIGHLIGHT_OPTS = [
  { value: "yellow", label: "Yellow" },
  { value: "green", label: "Green" },
  { value: "blue", label: "Blue" },
  { value: "pink", label: "Pink" },
];

export default function ReadingPage() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<Record<string, string | boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsAPI.getReading()
      .then((res) => {
        const d = (res.data || {}) as Record<string, string | boolean>;
        if (typeof d.theme === "string" && d.theme) setTheme(d.theme);
        setPrefs(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (key: string, val: string | boolean) => setPrefs((p) => ({ ...p, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsAPI.updateReading(prefs as Record<string, string>);
      toast({ title: "Reading preferences saved", variant: "success" });
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
      <SettingsSection title="Reading Preferences" description="Customize how stories appear when you read.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="Reading Font"><Select value={str("reading_font", "sans")} onChange={(v) => set("reading_font", v)} options={FONT_OPTS} /></Field>
          <Field label="Font Size"><Select value={str("font_size", "medium")} onChange={(v) => set("font_size", v)} options={SIZE_OPTS} /></Field>
          <Field label="Line Spacing"><Select value={str("line_spacing", "normal")} onChange={(v) => set("line_spacing", v)} options={SPACING_OPTS} /></Field>
          <Field label="Highlight Color"><Select value={str("highlight_color", "yellow")} onChange={(v) => set("highlight_color", v)} options={HIGHLIGHT_OPTS} /></Field>
        </div>

        <div className="mt-5">
          <Field label="Theme">
            <div className="flex gap-2">
              {[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "system", label: "System" },
              ].map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => { setTheme(t.value); set("theme", t.value); }}
                  className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                    (theme || "system") === t.value
                      ? "border-foreground bg-foreground text-background"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <div className="divide-y divide-border/60 mt-4">
          <PrefRow
            title="Auto Dark Mode"
            description="Automatically switch to dark mode in the evening"
            checked={bool("auto_dark_mode", false)}
            onChange={(v) => set("auto_dark_mode", v)}
          />
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
