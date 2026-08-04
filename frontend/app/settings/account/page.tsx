"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/components/toast-provider";
import { settingsAPI, profilesAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SettingsSection, Field, Select } from "@/components/settings/controls";
import { getInitials } from "@/lib/utils";
import { Loader2, Upload } from "lucide-react";

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "bn", label: "Bengali" },
  { value: "ta", label: "Tamil" },
  { value: "te", label: "Telugu" },
  { value: "mr", label: "Marathi" },
];

const TIMEZONES = [
  "UTC", "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London",
  "Europe/Berlin", "America/New_York", "America/Chicago", "America/Los_Angeles",
  "Australia/Sydney",
].map((t) => ({ value: t, label: t }));

export default function AccountSettingsPage() {
  const { user, updateUser } = useAuthStore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [avatarUrl, setAvatarUrl] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [location, setLocation] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState("en");
  const [timezone, setTimezone] = useState("UTC");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.display_name || "");
    setUsername(user.username || "");
    setBio(user.bio || "");
    setWebsite(user.website || "");
    setLocation(user.location || "");
    setEmail(user.email || "");
    setAvatarUrl(user.avatar_url || "");

    settingsAPI
      .getAccount()
      .then((res) => {
        const a = res.data;
        if (a) {
          setUsername(a.username || user.username || "");
          setEmail(a.email || user.email || "");
          setPhone(a.phone || "");
          setLanguage(a.language || "en");
          setTimezone(a.timezone || "UTC");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image must be under 5MB", variant: "error" });
      return;
    }
    setUploading(true);
    try {
      const token = localStorage.getItem("access_token");
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "/api/v1"}/avatars/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Upload failed");
      const url = data.data?.avatar_url || data.data?.url || "";
      setAvatarUrl(url);
      updateUser({ avatar_url: url });
      toast({ title: "Profile photo updated", variant: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Upload failed", variant: "error" });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (bio && (bio.length < 0 || bio.length > 300)) {
      toast({ title: "Bio must be 300 characters or fewer", variant: "error" });
      return;
    }
    if (website && !/^https?:\/\//i.test(website)) {
      toast({ title: "Website must start with http:// or https://", variant: "error" });
      return;
    }
    setSaving(true);
    try {
      // Profile fields via existing profiles endpoint.
      await profilesAPI.updateMe(user.id, {
        name: name.trim(),
        bio: bio.trim(),
        website: website.trim(),
        location: location.trim(),
      });
      // Account fields via new settings endpoint.
      await settingsAPI.updateAccount({
        username: username.trim(),
        email: email.trim(),
        phone: phone.trim(),
        language,
        timezone,
      });
      updateUser({
        display_name: name.trim() || user.display_name,
        username: username.trim() || user.username,
        email: email.trim() || user.email,
        bio: bio.trim(),
        website: website.trim(),
        location: location.trim(),
      });
      toast({ title: "Account settings saved", variant: "success" });
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
      <SettingsSection title="Account Settings" description="Basic account management.">
        <div className="space-y-5">
          {/* Profile photo */}
          <Field label="Profile Photo">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={avatarUrl} alt={name} />
                <AvatarFallback>{getInitials(name || user?.display_name || "U")}</AvatarFallback>
              </Avatar>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              <Button type="button" variant="outline" size="sm" className="rounded-full" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Upload photo
              </Button>
            </div>
          </Field>

          <Field label="Full Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
          </Field>

          <Field label="Username" hint="Your unique URL: /your-username">
            <Input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={30} />
          </Field>

          <Field label="Bio" hint={`${bio.length}/300 characters (160-300 recommended)`}>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={300} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Website">
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
            </Field>
            <Field label="Location">
              <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Email Address">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Phone Number (optional)">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 ..." />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Language">
              <Select value={language} onChange={setLanguage} options={LANGUAGES} />
            </Field>
            <Field label="Time Zone">
              <Select value={timezone} onChange={setTimezone} options={TIMEZONES} />
            </Field>
          </div>
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
