"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { profilesAPI } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/components/toast-provider";
import { Loader2, ArrowLeft } from "lucide-react";

export default function ProfileSettingsPage() {
  const router = useRouter();
  const { user, isAuthenticated, updateUser } = useAuthStore();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    // Prefill from auth store, then overlay the profile record if one exists.
    setName(user?.display_name || "");
    setBio(user?.bio || "");
    setWebsite(user?.website || "");
    setLocation(user?.location || "");

    profilesAPI
      .getMe()
      .then((res) => {
        const p = res.data;
        if (p) {
          setName(p.name || user?.display_name || "");
          setHeadline(p.headline || "");
          setBio(p.bio || "");
          setWebsite(p.website || "");
          setLocation(p.location || "");
        }
      })
      .catch(() => {
        // No profile row yet — that's fine, the form still works (upsert on save).
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    if (typeof window !== "undefined") {
      router.push("/login");
    }
    return null;
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (website && !/^https?:\/\//i.test(website)) {
      toast({ title: "Website must start with http:// or https://", variant: "error" });
      return;
    }

    setSaving(true);
    try {
      await profilesAPI.updateMe(user.id, {
        name: name.trim(),
        headline: headline.trim(),
        bio: bio.trim(),
        website: website.trim(),
        location: location.trim(),
      });
      // Reflect the new display name/bio in the auth store so the navbar/profile update.
      updateUser({
        display_name: name.trim() || user.display_name,
        bio: bio.trim(),
        website: website.trim(),
        location: location.trim(),
      });
      toast({ title: "Profile updated", variant: "success" });
    } catch (error) {
      console.error("Failed to update profile:", error);
      toast({
        title: error instanceof Error ? error.message : "Failed to update profile",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-[640px]">
        <Link
          href={`/@${user?.username}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to profile
        </Link>

        <h1 className="text-3xl font-bold mb-2">Edit profile</h1>
        <p className="text-muted-foreground mb-8">
          Update your public profile information.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading profile...
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label htmlFor="name" className="text-sm font-medium mb-1.5 block">
                Display name
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                placeholder="Your name"
              />
            </div>

            <div>
              <label htmlFor="headline" className="text-sm font-medium mb-1.5 block">
                Headline
              </label>
              <Input
                id="headline"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                maxLength={200}
                placeholder="A short tagline (e.g. Writer, Developer)"
              />
            </div>

            <div>
              <label htmlFor="bio" className="text-sm font-medium mb-1.5 block">
                Bio
              </label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={2000}
                rows={5}
                placeholder="Tell readers about yourself..."
                className="resize-none"
              />
            </div>

            <div>
              <label htmlFor="website" className="text-sm font-medium mb-1.5 block">
                Website
              </label>
              <Input
                id="website"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                maxLength={500}
                placeholder="https://yoursite.com"
              />
            </div>

            <div>
              <label htmlFor="location" className="text-sm font-medium mb-1.5 block">
                Location
              </label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={100}
                placeholder="City, Country"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={saving} className="rounded-full px-6">
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
              <Link href="/settings/api-keys">
                <Button type="button" variant="ghost">
                  Manage API keys
                </Button>
              </Link>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
