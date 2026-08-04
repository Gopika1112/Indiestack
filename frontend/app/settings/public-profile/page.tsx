"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/components/toast-provider";
import { settingsAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SettingsSection, Field, Select } from "@/components/settings/controls";
import { getInitials } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export default function PublicProfilePage() {
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [shortBio, setShortBio] = useState("");
  const [website, setWebsite] = useState("");
  const [github, setGithub] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [twitter, setTwitter] = useState("");
  const [instagram, setInstagram] = useState("");
  const [youtube, setYoutube] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.display_name || "");
    settingsAPI
      .getPublicProfile()
      .then((res) => {
        const p = res.data;
        if (p) {
          setDisplayName(p.name || user.display_name || "");
          setCoverImage(p.cover_image_url || "");
          setShortBio(p.short_bio || "");
          setWebsite(p.website || "");
          setGithub(p.github_url || "");
          setLinkedin(p.linkedin_url || "");
          setTwitter(p.twitter_url || "");
          setInstagram(p.instagram_url || "");
          setYoutube(p.youtube_url || "");
          setVisibility(p.profile_visibility || "public");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await settingsAPI.updatePublicProfile({
        display_name: displayName.trim(),
        cover_image_url: coverImage.trim(),
        short_bio: shortBio.trim(),
        website: website.trim(),
        github_url: github.trim(),
        linkedin_url: linkedin.trim(),
        twitter_url: twitter.trim(),
        instagram_url: instagram.trim(),
        youtube_url: youtube.trim(),
        profile_visibility: visibility,
      });
      toast({ title: "Public profile saved", variant: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Save failed", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <SettingsSection title="Public Profile" description="Controls what readers see on your profile.">
        <div className="space-y-5">
          <Field label="Display Name">
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={100} />
          </Field>

          <Field label="Profile Picture">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user?.avatar_url} alt={displayName} />
                <AvatarFallback>{getInitials(displayName || "U")}</AvatarFallback>
              </Avatar>
              <p className="text-sm text-muted-foreground">Change your photo in Account Settings.</p>
            </div>
          </Field>

          <Field label="Cover Image (optional)" hint="URL to a wide banner image.">
            <Input value={coverImage} onChange={(e) => setCoverImage(e.target.value)} placeholder="https://" />
          </Field>

          <Field label="Short Bio" hint="A one-line intro shown under your name.">
            <Textarea value={shortBio} onChange={(e) => setShortBio(e.target.value)} rows={2} maxLength={160} />
          </Field>

          <div className="pt-2">
            <h3 className="text-sm font-semibold mb-3">Featured Links</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Website"><Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" /></Field>
              <Field label="GitHub"><Input value={github} onChange={(e) => setGithub(e.target.value)} placeholder="https://github.com/..." /></Field>
              <Field label="LinkedIn"><Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/..." /></Field>
              <Field label="Twitter / X"><Input value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="https://x.com/..." /></Field>
              <Field label="Instagram"><Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="https://instagram.com/..." /></Field>
              <Field label="YouTube"><Input value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder="https://youtube.com/..." /></Field>
            </div>
          </div>

          <Field label="Profile Visibility">
            <Select
              value={visibility}
              onChange={setVisibility}
              options={[
                { value: "public", label: "Public — anyone can view" },
                { value: "private", label: "Private — only followers" },
              ]}
            />
          </Field>
        </div>
      </SettingsSection>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving} className="rounded-full px-6">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </div>
    </form>
  );
}
