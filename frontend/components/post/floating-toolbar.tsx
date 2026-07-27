"use client";

import { useEffect, useState } from "react";
import { Heart, MessageCircle, Bookmark, Share2, LinkIcon } from "lucide-react";

interface FloatingToolbarProps {
  likeCount: number;
  commentCount: number;
}

export function FloatingToolbar({ likeCount, commentCount }: FloatingToolbarProps) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div className="flex items-center gap-1 px-4 py-2 rounded-full border bg-background/95 backdrop-blur shadow-lg">
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-muted-foreground hover:text-red-500 transition-colors rounded-full hover:bg-muted">
          <Heart className="h-5 w-5" />
          <span className="text-sm">{likeCount}</span>
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted">
          <MessageCircle className="h-5 w-5" />
          <span className="text-sm">{commentCount}</span>
        </button>
        <div className="w-px h-5 bg-border mx-1" />
        <button className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted">
          <Bookmark className="h-5 w-5" />
        </button>
        <button
          onClick={handleCopyLink}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted"
          title={copied ? "Copied!" : "Copy link"}
        >
          {copied ? <LinkIcon className="h-5 w-5 text-green-500" /> : <Share2 className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
