"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiKeysAPI, APIKeyItem } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/components/toast-provider";
import { formatDate } from "@/lib/utils";
import * as Dialog from "@radix-ui/react-dialog";
import { Key, Copy, Trash2, Plus, AlertTriangle, Check, ExternalLink } from "lucide-react";

const AVAILABLE_SCOPES = [
  { value: "posts:read", label: "Read posts", description: "Read your posts and drafts" },
  { value: "posts:write", label: "Write posts", description: "Create, update, and delete posts" },
  { value: "profile:read", label: "Read profile", description: "Read your profile info" },
  { value: "profile:write", label: "Update profile", description: "Update your profile" },
  { value: "feed:read", label: "Read feed", description: "Access feed and trending posts" },
] as const;

const EXPIRY_OPTIONS = [
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 365, label: "1 year" },
  { value: 0, label: "Never expires" },
] as const;

export default function APIKeysPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { toast } = useToast();

  const [keys, setKeys] = useState<APIKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [expiryDays, setExpiryDays] = useState(90);
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    loadKeys();
  }, [isAuthenticated, router]);

  const loadKeys = async () => {
    setLoading(true);
    try {
      const res = await apiKeysAPI.list();
      if (res.success && res.data) {
        setKeys(res.data);
      }
    } catch (error) {
      console.error("Failed to load API keys:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newKeyName.trim() || selectedScopes.length === 0) return;
    setCreating(true);
    try {
      const res = await apiKeysAPI.create({
        name: newKeyName,
        scopes: selectedScopes,
        expires_in_days: expiryDays || undefined,
      });
      if (res.success && res.data) {
        setCreatedKey(res.data.key);
        toast({ title: "API key created", variant: "success" });
        loadKeys();
      }
    } catch (error) {
      console.error("Failed to create key:", error);
      toast({ title: "Failed to create key", variant: "error" });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiKeysAPI.delete(id);
      toast({ title: "API key revoked", variant: "success" });
      loadKeys();
    } catch (error) {
      console.error("Failed to delete key:", error);
      toast({ title: "Failed to revoke key", variant: "error" });
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetModal = () => {
    setShowCreateModal(false);
    setCreatedKey(null);
    setNewKeyName("");
    setSelectedScopes([]);
    setExpiryDays(90);
  };

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 max-w-[680px]">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">API Keys</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage API keys for programmatic access.{" "}
              <Link href="/docs/api" className="text-primary hover:underline inline-flex items-center gap-1">
                View API docs <ExternalLink className="h-3 w-3" />
              </Link>
            </p>
          </div>
          <Button onClick={() => setShowCreateModal(true)} className="rounded-full gap-2">
            <Plus className="h-4 w-4" />
            New key
          </Button>
        </div>

        {/* Keys list */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="border rounded-lg p-4 animate-pulse">
                <div className="h-5 w-40 bg-muted rounded mb-2" />
                <div className="h-4 w-24 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : keys.length === 0 ? (
          <div className="text-center py-16 border rounded-lg">
            <Key className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">No API keys yet</p>
            <Button variant="outline" onClick={() => setShowCreateModal(true)} className="rounded-full">
              Create your first key
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map((k) => (
              <div
                key={k.id}
                className={`border rounded-lg p-4 ${!k.is_active ? "opacity-50" : ""}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{k.name}</span>
                      {!k.is_active && (
                        <span className="text-xs text-destructive bg-destructive/10 px-2 py-0.5 rounded">Revoked</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 font-mono">{k.key_prefix}...****</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {k.scopes.map((s) => (
                        <span key={s} className="text-xs bg-muted px-2 py-0.5 rounded">{s}</span>
                      ))}
                    </div>
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                      <span>Created {formatDate(k.created_at)}</span>
                      {k.last_used_at && <span>Last used {formatDate(k.last_used_at)}</span>}
                      {k.expires_at && <span>Expires {formatDate(k.expires_at)}</span>}
                    </div>
                  </div>
                  {k.is_active && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(k.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Key Modal */}
      <Dialog.Root open={showCreateModal} onOpenChange={(open) => { if (!open) resetModal(); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-background rounded-xl border shadow-2xl p-6">
            {createdKey ? (
              <>
                <Dialog.Title className="text-lg font-semibold mb-4">
                  API key created
                </Dialog.Title>
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4 flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    Save this key now — you won&apos;t be able to see it again.
                  </p>
                </div>
                <div className="flex items-center gap-2 bg-muted rounded-lg p-3 font-mono text-sm">
                  <code className="flex-1 break-all">{createdKey}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(createdKey)}
                  >
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="flex justify-end mt-6">
                  <Button onClick={resetModal} className="rounded-full">Done</Button>
                </div>
              </>
            ) : (
              <>
                <Dialog.Title className="text-lg font-semibold mb-1">
                  Create API key
                </Dialog.Title>
                <Dialog.Description className="text-sm text-muted-foreground mb-6">
                  API keys allow programmatic access to your account.
                </Dialog.Description>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Key name</label>
                    <Input
                      placeholder="My AI Agent"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Scopes</label>
                    <div className="space-y-2">
                      {AVAILABLE_SCOPES.map((scope) => (
                        <label key={scope.value} className="flex items-start gap-3 p-2 border rounded-lg hover:bg-muted/50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedScopes.includes(scope.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedScopes([...selectedScopes, scope.value]);
                              } else {
                                setSelectedScopes(selectedScopes.filter((s) => s !== scope.value));
                              }
                            }}
                            className="mt-0.5 h-4 w-4"
                          />
                          <div>
                            <span className="text-sm font-medium">{scope.label}</span>
                            <p className="text-xs text-muted-foreground">{scope.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Expiration</label>
                    <select
                      value={expiryDays}
                      onChange={(e) => setExpiryDays(Number(e.target.value))}
                      className="w-full rounded-md border px-3 py-2 text-sm bg-background"
                    >
                      {EXPIRY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <Button variant="ghost" onClick={resetModal}>Cancel</Button>
                  <Button
                    onClick={handleCreate}
                    disabled={creating || !newKeyName.trim() || selectedScopes.length === 0}
                    className="rounded-full px-6"
                  >
                    {creating ? "Creating..." : "Create key"}
                  </Button>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
