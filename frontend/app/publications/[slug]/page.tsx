"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { publicationsAPI, Publication, PublicationMember, Post } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/components/toast-provider";
import { useRouter } from "next/navigation";
import { PostCard } from "@/components/feed/post-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Users, FileText, Plus, Check, Loader2, X, Trash2 } from "lucide-react";

export default function PublicationDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { isAuthenticated, user } = useAuthStore();
  const { toast } = useToast();
  const router = useRouter();

  const [pub, setPub] = useState<Publication | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [members, setMembers] = useState<PublicationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [memberUsername, setMemberUsername] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [removingPost, setRemovingPost] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadMembers = async () => {
    try {
      const res = await publicationsAPI.members(slug);
      if (res.success && res.data) setMembers(res.data);
    } catch (err) {
      console.error("Failed to load members:", err);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [pubRes, postsRes] = await Promise.all([
          publicationsAPI.get(slug),
          publicationsAPI.posts(slug),
        ]);
        if (pubRes.success && pubRes.data) setPub(pubRes.data);
        if (postsRes.success && postsRes.data) setPosts(postsRes.data);
        await loadMembers();
      } catch (err) {
        console.error("Failed to load publication:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  const addMember = async () => {
    if (!memberUsername.trim()) return;
    setAddingMember(true);
    try {
      await publicationsAPI.addMember(slug, memberUsername.trim());
      toast({ title: `Added @${memberUsername.trim()}`, variant: "success" });
      setMemberUsername("");
      await loadMembers();
    } catch (err) {
      console.error("Add member failed:", err);
      toast({ title: "Couldn't add member", variant: "error" });
    } finally {
      setAddingMember(false);
    }
  };

  const removeMember = async (username: string) => {
    if (!window.confirm(`Remove @${username} from this publication?`)) return;
    setRemovingMember(username);
    try {
      await publicationsAPI.removeMember(slug, username);
      toast({ title: `Removed @${username}`, variant: "success" });
      await loadMembers();
    } catch (err) {
      console.error("Remove member failed:", err);
      toast({ title: "Couldn't remove member", variant: "error" });
    } finally {
      setRemovingMember(null);
    }
  };

  const toggleFollow = async () => {
    if (!isAuthenticated) {
      toast({ title: "Sign in to follow publications", variant: "error" });
      return;
    }
    setFollowBusy(true);
    try {
      if (following) {
        await publicationsAPI.unfollow(slug);
        setFollowing(false);
        setPub((p) => (p ? { ...p, follower_count: Math.max(p.follower_count - 1, 0) } : p));
      } else {
        await publicationsAPI.follow(slug);
        setFollowing(true);
        setPub((p) => (p ? { ...p, follower_count: p.follower_count + 1 } : p));
      }
    } catch {
      toast({ title: "Couldn't update follow", variant: "error" });
    } finally {
      setFollowBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${pub?.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await publicationsAPI.remove(slug);
      toast({ title: "Publication deleted", variant: "success" });
      router.push("/publications");
    } catch (err) {
      console.error("Delete publication failed:", err);
      toast({ title: "Couldn't delete publication", variant: "error" });
      setDeleting(false);
    }
  };

  const removePost = async (postId: string) => {
    setRemovingPost(postId);
    try {
      await publicationsAPI.removePost(slug, postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      toast({ title: "Removed from publication", variant: "success" });
    } catch (err) {
      console.error("Remove post failed:", err);
      toast({ title: "Couldn't remove post", variant: "error" });
    } finally {
      setRemovingPost(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-8 max-w-[680px]">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-4 w-full mb-8" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </main>
      </div>
    );
  }

  if (!pub) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Publication not found</h1>
        </main>
      </div>
    );
  }

  // Determine if the current user is the owner by checking the members list,
  // which is more reliable than comparing IDs (avoids hydration timing issues).
  const isOwner = isAuthenticated && user && members.some(
    (m) => m.id === user.id && m.role === "owner"
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="container mx-auto px-4 py-8 max-w-[680px] flex-1">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
            {pub.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pub.logo_url} alt={pub.name} className="h-full w-full object-cover" />
            ) : (
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold">{pub.name}</h1>
            {pub.description && (
              <p className="text-muted-foreground mt-1">{pub.description}</p>
            )}
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {pub.follower_count} followers
              </span>
              <span className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                {pub.post_count} stories
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={toggleFollow}
              disabled={followBusy}
              variant={following ? "outline" : "default"}
              className="rounded-full"
            >
              {following ? (
                <>
                  <Check className="mr-1.5 h-4 w-4" /> Following
                </>
              ) : (
                <>
                  <Plus className="mr-1.5 h-4 w-4" /> Follow
                </>
              )}
            </Button>
            {isOwner && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-full text-destructive hover:text-destructive border-destructive/40"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Members */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">Writers</h2>
          {members.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {members.map((m) => (
                <span
                  key={m.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border border-border"
                >
                  {m.display_name}
                  {m.role === "owner" && (
                    <span className="text-xs text-muted-foreground">(owner)</span>
                  )}
                  {isOwner && m.role !== "owner" && (
                    <button
                      onClick={() => removeMember(m.username)}
                      disabled={removingMember === m.username}
                      className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                      title={`Remove @${m.username}`}
                    >
                      {removingMember === m.username ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
          {isOwner && (
            <div className="flex gap-2">
              <Input
                placeholder="Add writer by username (e.g. alice_writes)"
                value={memberUsername}
                onChange={(e) => setMemberUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addMember()}
                className="rounded-full"
              />
              <Button
                onClick={addMember}
                disabled={addingMember || !memberUsername.trim()}
                className="rounded-full shrink-0"
              >
                {addingMember ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
              </Button>
            </div>
          )}
        </div>

        {/* Posts */}
        <h2 className="text-lg font-semibold mb-4">Stories</h2>
        {posts.length > 0 ? (
          <div className="space-y-4">
            {posts.map((post) => (
              <div key={post.id} className="relative border rounded-lg p-4 hover:shadow-sm transition-shadow">
                <PostCard post={post} />
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-3 right-3 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => removePost(post.id)}
                    disabled={removingPost === post.id}
                    title="Remove from publication"
                  >
                    {removingPost === post.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">No stories published here yet.</p>
          </div>
        )}
      </main>
    </div>
  );
}
