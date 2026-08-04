"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/components/toast-provider";
import { settingsAPI, SessionItem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsSection, Field, PrefRow } from "@/components/settings/controls";
import { Loader2, Monitor, Smartphone, LogOut } from "lucide-react";

export default function SecurityPage() {
  const { logout } = useAuthStore();
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  const [twoFA, setTwoFA] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [savingSecurity, setSavingSecurity] = useState(false);

  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  useEffect(() => {
    settingsAPI.getSecurity().then((res) => {
      if (res.data) {
        setTwoFA(res.data.two_factor_enabled);
        setRecoveryEmail(res.data.recovery_email || "");
      }
    }).catch(() => {});
    loadSessions();
  }, []);

  const loadSessions = () => {
    setLoadingSessions(true);
    settingsAPI.listSessions()
      .then((res) => setSessions(res.data || []))
      .catch(() => setSessions([]))
      .finally(() => setLoadingSessions(false));
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "New passwords do not match", variant: "error" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "New password must be at least 8 characters", variant: "error" });
      return;
    }
    setChangingPw(true);
    try {
      await settingsAPI.changePassword(currentPassword, newPassword);
      toast({ title: "Password changed. Please sign in again.", variant: "success" });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setTimeout(() => { logout(); window.location.href = "/login"; }, 1200);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to change password", variant: "error" });
    } finally {
      setChangingPw(false);
    }
  };

  const handleSaveSecurity = async () => {
    setSavingSecurity(true);
    try {
      await settingsAPI.updateSecurity({ two_factor_enabled: twoFA, recovery_email: recoveryEmail.trim() });
      toast({ title: "Security settings saved", variant: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Save failed", variant: "error" });
    } finally {
      setSavingSecurity(false);
    }
  };

  const handleRevokeAll = async () => {
    try {
      await settingsAPI.revokeAllSessions();
      toast({ title: "Logged out from all devices", variant: "success" });
      setTimeout(() => { logout(); window.location.href = "/login"; }, 800);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed", variant: "error" });
    }
  };

  return (
    <div className="space-y-6">
      <SettingsSection title="Change Password" description="Use a strong, unique password.">
        <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
          <Field label="Current Password">
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </Field>
          <Field label="New Password">
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </Field>
          <Field label="Confirm Password">
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </Field>
          <Button type="submit" disabled={changingPw} className="rounded-full px-6">
            {changingPw && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update password
          </Button>
        </form>
      </SettingsSection>

      <SettingsSection title="Security Features">
        <div className="divide-y divide-border/60">
          <PrefRow
            title="Two-Factor Authentication"
            description="Require a verification code in addition to your password."
            checked={twoFA}
            onChange={setTwoFA}
          />
          <div className="py-3">
            <Field label="Recovery Email" hint="Used to regain access if you lose your password.">
              <div className="max-w-sm">
                <Input type="email" value={recoveryEmail} onChange={(e) => setRecoveryEmail(e.target.value)} placeholder="backup@example.com" />
              </div>
            </Field>
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={handleSaveSecurity} disabled={savingSecurity} variant="outline" className="rounded-full px-6">
            {savingSecurity && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save security settings
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection title="Active Sessions" description="Devices currently signed in to your account.">
        {loadingSessions ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No other active sessions found.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  {/mobile|android|iphone/i.test(s.device || s.user_agent) ? (
                    <Smartphone className="h-5 w-5 text-muted-foreground shrink-0" />
                  ) : (
                    <Monitor className="h-5 w-5 text-muted-foreground shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{s.device || s.user_agent || "Unknown device"}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.ip || "unknown ip"} · last active {new Date(s.last_used_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => settingsAPI.revokeSession(s.id).then(loadSessions).catch(() => {})}
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 pt-4 border-t border-border/60">
          <Button onClick={handleRevokeAll} variant="outline" className="rounded-full px-6 text-destructive border-destructive/40 hover:bg-destructive/10">
            <LogOut className="mr-2 h-4 w-4" />
            Logout from all devices
          </Button>
        </div>
      </SettingsSection>
    </div>
  );
}
