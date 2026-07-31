"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Post,
  likesAPI,
  commentsAPI,
  repostsAPI,
  Comment,
} from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/components/toast-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Heart,
  MessageCircle,
  Repeat2,
  Share2,
  Link as LinkIcon,
  Send,
  Loader2,
} from "lucide-react";

interface PostActionsProps {
  post: Post;
  /** Show the comment thread inline (used on the post page). */
  showComments?: boolean;
}

export function PostActions({ post, showComments = false }: PostActionsProps) {
  const { isAuthenticated } = useAuthStore();
  const { toast } = useToast();

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.like_count || 0);
  const [reposted, setReposted] = useState(false);
  const [repostCount, setRepostCount] = useState(post.repost_count || 0);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const [commentsOpen, setCommentsOpen] = useState(showComments);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentCount, setCommentCount] = useState(post.comment_count || 0);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  const postUrl = () =>
    `${window.location.origin}/@${post.author_username}/${post.slug}`;

  const requireAuth = (action: string): boolean => {
    if (!isAuthenticated) {
      toast({ title: `Sign in to ${action}`, variant: "error" });
      return false;
    }
    return true;
  };

  const toggleLike = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!requireAuth("like posts") || busy) return;
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    setBusy("like");
    try {
      if (next) await likesAPI.like(post.id);
      else await likesAPI.unlike(post.id);
    } catch (err) {
      console.error("Like failed:", err);
      setLiked(!next);
      setLikeCount((c) => c + (next ? -1 : 1));
      toast({ title: "Couldn't update like", variant: "error" });
    } finally {
      setBusy(null);
    }
  };

  const toggleRepost = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!requireAuth("repost") || busy) return;
    const next = !reposted;
    setReposted(next);
    setRepostCount((c) => c + (next ? 1 : -1));
    setBusy("repost");
    try {
      if (next) {
        await repostsAPI.repost(post.id);
        toast({ title: "Reposted to your followers", variant: "success" });
      } else {
        await repostsAPI.unrepost(post.id);
      }
    } catch (err) {
      console.error("Repost failed:", err);
      setReposted(!next);
      setRepostCount((c) => c + (next ? -1 : 1));
      toast({ title: "Couldn't update repost", variant: "error" });
    } finally {
      setBusy(null);
    }
  };

  const handleShare = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const url = postUrl();
    try {
      if (navigator.share) {
        await navigator.share({ title: post.title, url });
        return;
      }
      throw new Error("no-native-share");
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        toast({ title: "Link copied to clipboard", variant: "success" });
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast({ title: "Couldn't share post", variant: "error" });
      }
    }
  };

  const loadComments = async () => {
    try {
      const res = await commentsAPI.list(post.id);
      setComments(res.data || []);
      setCommentsLoaded(true);
    } catch (err) {
      console.error("Load comments failed:", err);
    }
  };

  useEffect(() => {
    if (showComments) {
      loadComments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showComments, post.id]);

  const toggleComments = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const open = !commentsOpen;
    setCommentsOpen(open);
    if (open && !commentsLoaded) loadComments();
  };

  const submitComment = async () => {
    if (!requireAuth("comment")) return;
    const body = draft.trim();
    if (!body) return;
    setPosting(true);
    try {
      await commentsAPI.add(post.id, body);
      setDraft("");
      setCommentCount((c) => c + 1);
      await loadComments();
      toast({ title: "Comment posted", variant: "success" });
    } catch (err) {
      console.error("Comment failed:", err);
      toast({ title: "Couldn't post comment", variant: "error" });
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center gap-1">
        {/* Like */}
        <button
          onClick={toggleLike}
          disabled={busy === "like"}
          title={liked ? "Unlike" : "Like"}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-full text-sm transition-colors hover:bg-muted ${
            liked ? "text-red-500" : "text-muted-foreground hover:text-red-500"
          }`}
        >
          <Heart className={`h-[18px] w-[18px] ${liked ? "fill-current" : ""}`} />
          <span>{likeCount}</span>
        </button>

        {/* Comment */}
        <button
          onClick={toggleComments}
          title="Comments"
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-full text-sm text-muted-foreground hover:text-foreground transition-colors hover:bg-muted"
        >
          <MessageCircle className="h-[18px] w-[18px]" />
          <span>{commentCount}</span>
        </button>

        {/* Repost */}
        <button
          onClick={toggleRepost}
          disabled={busy === "repost"}
          title={reposted ? "Undo repost" : "Repost"}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-full text-sm transition-colors hover:bg-muted ${
            reposted ? "text-green-600" : "text-muted-foreground hover:text-green-600"
          }`}
        >
          <Repeat2 className="h-[18px] w-[18px]" />
          <span>{repostCount}</span>
        </button>

        {/* Share */}
        <button
          onClick={handleShare}
          title="Share"
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-full text-sm text-muted-foreground hover:text-foreground transition-colors hover:bg-muted"
        >
          {copied ? (
            <LinkIcon className="h-[18px] w-[18px] text-green-500" />
          ) : (
            <Share2 className="h-[18px] w-[18px]" />
          )}
        </button>
      </div>

      {/* Comment thread */}
      {commentsOpen && (
        <div
          className="mt-3 border-t pt-3"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {isAuthenticated && (
            <div className="flex gap-2 mb-4">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a comment..."
                rows={2}
                className="resize-none text-sm"
                maxLength={5000}
              />
              <Button
                size="sm"
                onClick={submitComment}
                disabled={posting || !draft.trim()}
                className="self-end rounded-full"
              >
                {posting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}
          {!commentsLoaded ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading comments...
            </div>
          ) : comments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No comments yet. Be the first to comment.
            </p>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="text-sm">
                  <Link href={`/@${c.username}`} className="font-medium hover:underline">
                    @{c.username}
                  </Link>
                  <p className="text-foreground mt-0.5 whitespace-pre-wrap">{c.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
