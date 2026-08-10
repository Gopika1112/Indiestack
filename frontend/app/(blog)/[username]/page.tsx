"use client";




import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";


import { userAPI, postAPI, mutesAPI, User, Post, MutedUser, FollowListUser } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PostCard } from "@/components/feed/post-card";
import { formatDate, getInitials } from "@/lib/utils";
import * as Dialog from "@radix-ui/react-dialog";
import { MapPin, Link as LinkIcon, Calendar, PenLine, Ban, Loader2 } from "lucide-react";

export default function ProfilePage() {
  const params = useParams();
  const rawUsername = decodeURIComponent(params.username as string);
  const username = rawUsername.startsWith("@") ? rawUsername.slice(1) : rawUsername;
  const { user: currentUser, isAuthenticated } = useAuthStore();

  const [profile, setProfile] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [mutedUsers, setMutedUsers] = useState<MutedUser[]>([]);
  // Followers / Following list modal state
  const [listOpen, setListOpen] = useState<"followers" | "following" | null>(null);
  const [listUsers, setListUsers] = useState<FollowListUser[]>([]);
  const [listLoading, setListLoading] = useState(false);
































  const isOwnProfile = currentUser?.username === username;

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const [userResponse, postsResponse, mutesResponse] = await Promise.all([
        userAPI.getByUsername(username),
        postAPI.listByAuthor(username, { limit: 20 }),
        mutesAPI.list(),
      ]);

      if (userResponse.success && userResponse.data) {
        setProfile(userResponse.data);
      }
      if (postsResponse.success && postsResponse.data) {
        setPosts(postsResponse.data);
      }
      if (mutesResponse.success && mutesResponse.data) {
        const muted = mutesResponse.data as MutedUser[];
        setMutedUsers(muted);
        if (userResponse.data) {
          setIsMuted(muted.some((m) => m.id === userResponse.data!.id));
        }
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleFollow = async () => {
    if (!isAuthenticated || !profile) return;
    setFollowLoading(true);
    const next = !isFollowing;
    try {
      if (next) {
        await userAPI.follow(profile.id);
        setIsFollowing(true);
        setProfile({ ...profile, follower_count: profile.follower_count + 1 });
      } else {
        await userAPI.unfollow(profile.id);
        setIsFollowing(false);
        setProfile({ ...profile, follower_count: Math.max(profile.follower_count - 1, 0) });
      }
    } catch (error) {
      console.error("Follow action failed:", error);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleMute = async () => {
    if (!isAuthenticated || !profile) return;

    try {
      if (isMuted) {
        await mutesAPI.unmute(profile.id);
        setMutedUsers(mutedUsers.filter((m) => m.id !== profile.id));
      } else {
        await mutesAPI.mute(profile.id);
        setMutedUsers([...mutedUsers, { id: profile.id, username: profile.username } as MutedUser]);
      }
      setIsMuted(!isMuted);
    } catch (error) {
      console.error("Mute action failed:", error);
    }
  };

  const openFollowList = async (kind: "followers" | "following") => {
    setListOpen(kind);
    setListLoading(true);
    setListUsers([]);
    try {
      const res =
        kind === "followers"
          ? await userAPI.getFollowers(username)
          : await userAPI.getFollowing(username);
      setListUsers(res.data || []);
    } catch (error) {
      console.error(`Failed to load ${kind}:`, error);
    } finally {
      setListLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-8 max-w-[680px]">
          <div className="flex items-center gap-4 mb-8">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="h-4 w-full" />
        </main>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">User not found</h1>
          <p className="text-muted-foreground">
            The user @{username} does not exist.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="container mx-auto px-4 py-8 max-w-[680px] flex-1">
        {/* Profile header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={profile.avatar_url} alt={profile.display_name} />
              <AvatarFallback className="text-2xl">
                {getInitials(profile.display_name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold">{profile.display_name}</h1>
              <p className="text-muted-foreground">@{profile.username}</p>
            </div>
          </div>
          {isOwnProfile ? (
            <Link href="/settings/profile">
              <Button variant="outline" size="sm" className="rounded-full">
                Edit profile
              </Button>
            </Link>
          ) : (
            <div className="flex gap-2">
              <Button
                onClick={handleFollow}
                disabled={followLoading || !isAuthenticated}
                variant={isFollowing ? "outline" : "default"}
                size="sm"
                className="rounded-full px-5"
              >
                {isFollowing ? "Following" : "Follow"}
              </Button>
              <Button
                onClick={handleMute}
                variant="outline"
                size="sm"
                className={`rounded-full ${isMuted ? "text-red-500" : ""}`}
              >
                <Ban className="h-4 w-4 mr-1" />
                {isMuted ? "Muted" : "Mute"}
              </Button>
            </div>
          )}
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-foreground mb-4 leading-relaxed">{profile.bio}</p>
        )}

        {/* Meta info */}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
          {profile.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {profile.location}
            </span>
          )}
          {profile.website && (
            <a
              href={profile.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-primary"
            >
              <LinkIcon className="h-4 w-4" />
              {profile.website.replace(/^https?:\/\//, "")}
            </a>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            Joined {formatDate(profile.created_at)}
          </span>
        </div>

        {/* Stats — Following / Followers open a list modal */}
        <div className="flex gap-5 text-sm mb-8">
          <button
            onClick={() => openFollowList("following")}
            className="hover:underline underline-offset-2"
          >
            <strong>{profile.following_count}</strong>{" "}
            <span className="text-muted-foreground">Following</span>
          </button>
          <button
            onClick={() => openFollowList("followers")}
            className="hover:underline underline-offset-2"
          >
            <strong>{profile.follower_count}</strong>{" "}
            <span className="text-muted-foreground">Followers</span>
          </button>
          <span>
            <strong>{posts.length}</strong>{" "}
            <span className="text-muted-foreground">Posts</span>
          </span>
        </div>

        {/* Posts */}
        {posts.length > 0 ? (
          <div>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <PenLine className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">No stories yet.</p>
            {isOwnProfile && (
              <Link href="/write">
                <Button variant="outline" className="rounded-full">
                  Write your first story
                </Button>
              </Link>
            )}
          </div>
        )}
      </main>

      {/* Followers / Following list modal */}
      <Dialog.Root open={listOpen !== null} onOpenChange={(open) => !open && setListOpen(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-background rounded-xl border shadow-2xl p-6 max-h-[70vh] overflow-y-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
            <Dialog.Title className="text-lg font-semibold mb-4 capitalize">
              {listOpen === "followers" ? "Followers" : "Following"}
            </Dialog.Title>
            {listLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-6 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
              </div>
            ) : listUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {listOpen === "followers" ? "No followers yet." : "Not following anyone yet."}
              </p>
            ) : (
              <div className="space-y-4">
                {listUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-3">
                    <Link href={`/@${u.username}`} onClick={() => setListOpen(null)}>
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={u.avatar_url} alt={u.display_name} />
                        <AvatarFallback>{getInitials(u.display_name)}</AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="min-w-0">
                      <Link
                        href={`/@${u.username}`}
                        onClick={() => setListOpen(null)}
                        className="font-medium hover:underline block truncate"
                      >
                        {u.display_name}
                      </Link>
                      <p className="text-sm text-muted-foreground truncate">@{u.username}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
