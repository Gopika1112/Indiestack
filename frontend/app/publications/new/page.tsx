"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { publicationsAPI } from "@/lib/api";
import { useToast } from "@/components/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

export default function NewPublicationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await publicationsAPI.create({
        name: name.trim(),
        slug: slug.trim() || undefined,
        description: description.trim() || undefined,
      });
      toast({ title: "Publication created", variant: "success" });
      router.push(`/publications/${res.data?.slug || slug}`);
    } catch (err) {
      console.error("Create publication failed:", err);
      toast({ title: "Failed to create publication", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="container mx-auto px-4 py-8 max-w-[680px] flex-1">
        <h1 className="text-3xl font-bold mb-6">Create a publication</h1>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Name</label>
            <Input
              placeholder="e.g. Tech Weekly"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Slug (optional)</label>
            <Input
              placeholder="tech-weekly"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Used in the URL. Leave blank to auto-generate from the name.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Description</label>
            <Textarea
              placeholder="What is this publication about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>
          <Button onClick={handleCreate} disabled={saving || !name.trim()} className="rounded-full px-6">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create publication
          </Button>
        </div>
      </main>
    </div>
  );
}
