"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/components/toast-provider";
import { settingsAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { SettingsSection } from "@/components/settings/controls";
import { Loader2, Trash2, PauseCircle, FileX, LogOut } from "lucide-react";

export default function DangerPage() {
  const router = useRouter();
  const { logout } = useAuthStore();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<unknown>, confirmMsg: string, onSuccess?: () => void) => {
    if (!window.confirm(confirmMsg)) return;
    setBusy(key);
    try {
      await fn();
      toast({ title: "Done", variant: "success" });
      onSuccess?.();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Action failed", variant: "error" });
    } finally {
      setBusy(null);
    }
  };

  const signOutEverywhere = () =>
    run(
      "logout",
      () => settingsAPI.revokeAllSessions(),
      "Log out from all devices including this one?",
      () => { logout(); router.push("/login"); }
    );

  const removeStories = () =>
    run(
      "stories",
      () => settingsAPI.removeAllStories(),
      "Archive ALL your stories? They will no longer be public."
    );

  const deactivate = () =>
    run(
      "deactivate",
      () => settingsAPI.deactivateAccount(),
      "Deactivate your account? You can reactivate by signing back in.",
      () => { logout(); router.push("/"); }
    );

  const deleteAccount = () =>
    run(
      "delete",
      () => settingsAPI.deleteAccount(),
      "PERMANENTLY delete your account and all data? This cannot be undone.",
      () => { logout(); router.push("/"); }
    );

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
        <h2 className="text-lg font-semibold text-destructive flex items-center gap-2">
          <Trash2 className="h-5 w-5" /> Danger Zone
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          These actions are destructive and some cannot be undone. Proceed with caution.
        </p>
      </div>

      <SettingsSection title="Logout Everywhere" description="Sign out of all devices, including this one." danger>
        <Button variant="outline" disabled={busy === "logout"} onClick={signOutEverywhere}
          className="rounded-full px-6 text-destructive border-destructive/40 hover:bg-destructive/10">
          {busy === "logout" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
          Logout everywhere
        </Button>
      </SettingsSection>

      <SettingsSection title="Remove All Stories" description="Archive every story you've published." danger>
        <Button variant="outline" disabled={busy === "stories"} onClick={removeStories}
          className="rounded-full px-6 text-destructive border-destructive/40 hover:bg-destructive/10">
          {busy === "stories" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileX className="mr-2 h-4 w-4" />}
          Remove all stories
        </Button>
      </SettingsSection>

      <SettingsSection title="Deactivate Account" description="Temporarily disable your account. You can reactivate later." danger>
        <Button variant="outline" disabled={busy === "deactivate"} onClick={deactivate}
          className="rounded-full px-6 text-destructive border-destructive/40 hover:bg-destructive/10">
          {busy === "deactivate" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PauseCircle className="mr-2 h-4 w-4" />}
          Deactivate account
        </Button>
      </SettingsSection>

      <SettingsSection title="Delete Account" description="Permanently delete your account and all associated data." danger>
        <Button variant="destructive" disabled={busy === "delete"} onClick={deleteAccount} className="rounded-full px-6">
          {busy === "delete" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
          Delete account permanently
        </Button>
      </SettingsSection>
    </div>
  );
}
