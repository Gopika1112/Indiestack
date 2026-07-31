"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

export function Navbar() {
  const { theme, setTheme } = useTheme();
  const { isAuthenticated } = useAuthStore();
  // Avoid hydration mismatch for theme icon
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-border/60 bg-background/80 backdrop-blur-sm">
      <div className="flex h-full items-center justify-between px-6">
        {/* Left: mobile spacing for hamburger, otherwise empty (logo lives in sidebar) */}
        <div className="flex items-center lg:w-0 w-10" />

        {/* Right: theme toggle + auth actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            aria-label="Toggle theme"
          >
            {mounted && theme === "dark" ? (
              <Sun className="h-5 w-5" strokeWidth={1.8} />
            ) : (
              <Moon className="h-5 w-5" strokeWidth={1.8} />
            )}
          </button>

          {!isAuthenticated && (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm" className="rounded-full">
                  Sign in
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="rounded-full">
                  Get started
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
