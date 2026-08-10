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
  Pencil,
  Trash2,
  Check,
  X,
} from "lucide-react";

interface PostActionsProps {
  post: Post;
  /** Show the comment thread inline (used on the post page). */
  showComments?: boolean;
}

export function PostActions({ post, showComments = false }: PostActionsProps) {
  const { isAuthenticated, user } = useAuthStore();
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [commentBusy, setCommentBusy] = useState<string | null>(null);

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

  const toggleCommentLike = async (c: Comment) => {
    if (!requireAuth("like comments") || commentBusy) return;
    const next = !c.liked;
    setCommentBusy(c.id);
    // Optimistic update
    setComments((prev) =>
      prev.map((x) =>
        x.id === c.id
          ? { ...x, liked: next, like_count: x.like_count + (next ? 1 : -1) }
          : x
      )
    );
    try {
      if (next) await commentsAPI.like(c.id);
      else await commentsAPI.unlike(c.id);
    } catch (err) {
      console.error("Comment like failed:", err);
      setComments((prev) =>
        prev.map((x) =>
          x.id === c.id
            ? { ...x, liked: !next, like_count: x.like_count + (next ? -1 : 1) }
            : x
        )
      );
      toast({ title: "Couldn't update like", variant: "error" });
    } finally {
      setCommentBusy(null);
    }
  };

  const startEdit = (c: Comment) => {
    setEditingId(c.id);
    setEditDraft(c.body);
  };

  const saveEdit = async (c: Comment) => {
    const body = editDraft.trim();
    if (!body) return;
    setCommentBusy(c.id);
    try {
      await commentsAPI.update(c.id, body);
      setComments((prev) => prev.map((x) => (x.id === c.id ? { ...x, body } : x)));
      setEditingId(null);
      toast({ title: "Comment updated", variant: "success" });
    } catch (err) {
      console.error("Comment update failed:", err);
      toast({ title: "Couldn't update comment", variant: "error" });
    } finally {
      setCommentBusy(null);
    }
  };

  const deleteComment = async (c: Comment) => {
    if (!window.confirm("Delete this comment?")) return;
    setCommentBusy(c.id);
    try {
      await commentsAPI.delete(c.id);
      setComments((prev) => prev.filter((x) => x.id !== c.id));
      setCommentCount((n) => Math.max(n - 1, 0));
      toast({ title: "Comment deleted", variant: "success" });
    } catch (err) {
      console.error("Comment delete failed:", err);
      toast({ title: "Couldn't delete comment", variant: "error" });
    } finally {
      setCommentBusy(null);
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
            <div className="space-y-4">
              {comments.map((c) => {
                const isOwn = user?.id === c.user_id;
                const isEditing = editingId === c.id;
                return (
                  <div key={c.id} className="text-sm">
                    <div className="flex items-center gap-2">
                      <Link href={`/@${c.username}`} className="font-medium hover:underline">
                        @{c.username}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {isEditing ? (
                      <div className="mt-1.5 flex gap-2">
                        <Textarea
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          rows={2}
                          className="resize-none text-sm"
                          maxLength={5000}
                        />
                        <div className="flex flex-col gap-1 self-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => saveEdit(c)}
                            disabled={commentBusy === c.id || !editDraft.trim()}
                            title="Save"
                          >
                            {commentBusy === c.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                            title="Cancel"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-foreground mt-0.5 whitespace-pre-wrap">{c.body}</p>
                    )}

                    {/* Comment actions */}
                    {!isEditing && (
                      <div className="flex items-center gap-1 mt-1">
                        <button
                          onClick={() => toggleCommentLike(c)}
                          disabled={commentBusy === c.id}
                          title={c.liked ? "Unlike" : "Like"}
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs transition-colors hover:bg-muted ${
                            c.liked ? "text-red-500" : "text-muted-foreground hover:text-red-500"
                          }`}
                        >
                          <Heart className={`h-3.5 w-3.5 ${c.liked ? "fill-current" : ""}`} />
                          <span>{c.like_count}</span>
                        </button>
                        {isOwn && (
                          <>
                            <button
                              onClick={() => startEdit(c)}
                              title="Edit comment"
                              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs text-muted-foreground hover:text-foreground transition-colors hover:bg-muted"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </button>
                            <button
                              onClick={() => deleteComment(c)}
                              disabled={commentBusy === c.id}
                              title="Delete comment"
                              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs text-muted-foreground hover:text-destructive transition-colors hover:bg-muted"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
