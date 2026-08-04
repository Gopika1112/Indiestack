"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/toast-provider";
import { settingsAPI, ConnectedAccount } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { SettingsSection } from "@/components/settings/controls";
import { Loader2 } from "lucide-react";

const PROVIDERS = [
  { id: "google", label: "Google" },
  { id: "github", label: "GitHub" },
  { id: "apple", label: "Apple" },
  { id: "discord", label: "Discord" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "twitter", label: "Twitter / X" },
];

export default function ConnectedAccountsPage() {
  const { toast } = useToast();
  const [connected, setConnected] = useState<Record<string, ConnectedAccount>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    settingsAPI.listConnected()
      .then((res) => {
        const map: Record<string, ConnectedAccount> = {};
        (res.data || []).forEach((c) => { map[c.provider] = c; });
        setConnected(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleConnect = async (provider: string) => {
    setBusy(provider);
    try {
      // Placeholder connect (real OAuth flow would redirect to the provider).
      await settingsAPI.connectAccount(provider);
      setConnected((c) => ({ ...c, [provider]: { provider, provider_account_id: "", connected_at: new Date().toISOString() } }));
      toast({ title: `${provider} connected`, variant: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Connect failed", variant: "error" });
    } finally {
      setBusy(null);
    }
  };

  const handleDisconnect = async (provider: string) => {
    setBusy(provider);
    try {
      await settingsAPI.disconnectAccount(provider);
      setConnected((c) => {
        const next = { ...c };
        delete next[provider];
        return next;
      });
      toast({ title: `${provider} disconnected`, variant: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Disconnect failed", variant: "error" });
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <SettingsSection title="Connected Accounts" description="Link social accounts for sign-in and sharing.">
        <ul className="divide-y divide-border/60">
          {PROVIDERS.map((p) => {
            const isConnected = !!connected[p.id];
            return (
              <li key={p.id} className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="text-sm font-medium">{p.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {isConnected
                      ? `Connected ${new Date(connected[p.id].connected_at).toLocaleDateString()}`
                      : "Not connected"}
                  </p>
                </div>
                {isConnected ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full text-destructive border-destructive/40 hover:bg-destructive/10"
                    disabled={busy === p.id}
                    onClick={() => handleDisconnect(p.id)}
                  >
                    {busy === p.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    disabled={busy === p.id}
                    onClick={() => handleConnect(p.id)}
                  >
                    {busy === p.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Connect
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted-foreground mt-4">
          Note: social sign-in is not yet enabled; connections are stored for future OAuth integration.
        </p>
      </SettingsSection>
    </div>
  );
}
