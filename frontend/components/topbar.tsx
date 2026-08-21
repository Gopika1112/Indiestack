"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { PenLine, User, FileText, Key, Settings, LogOut } from "lucide-react";
import { getInitials } from "@/lib/utils";

export function TopBar() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const pathname = usePathname();

  // Don't show the top bar on the landing page (it has its own nav).
  if (pathname === "/") return null;

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-border/60 bg-background/95 backdrop-blur">
      <div className="h-full max-w-[1600px] mx-auto px-4 lg:px-6 flex items-center justify-between">
        {/* Left: logo */}
        <Link href="/feed" className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-full bg-foreground flex items-center justify-center shrink-0">
            <span className="text-background font-bold text-sm">I</span>
          </div>
          <span className="text-xl font-bold tracking-tight whitespace-nowrap hidden sm:inline">
            IndieStack
          </span>
        </Link>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              {/* Write */}
              <Link href="/write">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`rounded-full gap-1.5 ${pathname === "/write" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <PenLine className="h-4 w-4" />
                  <span className="hidden sm:inline">Write</span>
                </Button>
              </Link>

              {/* Profile dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded-full hover:opacity-80 transition-opacity">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user?.avatar_url} alt={user?.display_name} />
                      <AvatarFallback className="text-xs">
                        {getInitials(user?.display_name || "U")}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium">{user?.display_name}</p>
                    <p className="text-xs text-muted-foreground">@{user?.username}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={`/@${user?.username}`} className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/drafts" className="cursor-pointer">
                      <FileText className="mr-2 h-4 w-4" />
                      Drafts
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings/api-keys" className="cursor-pointer">
                      <Key className="mr-2 h-4 w-4" />
                      API Keys
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={logout}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
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
