"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { listsAPI } from "@/lib/api";
import { useToast } from "@/components/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

export default function NewListPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await listsAPI.create({
        name: name.trim(),
        description: description.trim() || undefined,
        is_public: isPublic,
      });
      toast({ title: "List created", variant: "success" });
      router.push(`/lists/${res.data?.id}`);
    } catch (err) {
      console.error("Create list failed:", err);
      toast({ title: "Failed to create list", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="container mx-auto px-4 py-8 max-w-[680px] flex-1">
        <h1 className="text-3xl font-bold mb-6">Create a list</h1>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Name</label>
            <Input
              placeholder="e.g. AI must-reads"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Description</label>
            <Textarea
              placeholder="What is this list about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>
          <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
            <input
              type="checkbox"
              id="public"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="public" className="text-sm font-medium">
              Public list (visible to everyone)
            </label>
          </div>
          <Button onClick={handleCreate} disabled={saving || !name.trim()} className="rounded-full px-6">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create list
          </Button>
        </div>
      </main>
    </div>
  );
}
