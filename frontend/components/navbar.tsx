"use client";

import Link from "next/link";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PenLine, Menu, X, Sun, Moon, Search, Bell, User, FileText, Settings, LogOut, Key } from "lucide-react";
import { useState } from "react";
import { useTheme } from "next-themes";
import { getInitials } from "@/lib/utils";

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">I</span>
            </div>
            <span className="text-xl font-bold tracking-tight hidden sm:inline">IndieStack</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            <Link
              href="/feed"
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted"
            >
              Feed
            </Link>
            <Link
              href="/discover"
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted"
            >
              Discover
            </Link>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="hidden md:flex items-center gap-2">
          <Link
            href="/discover"
            className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted"
          >
            <Search className="h-5 w-5" />
          </Link>

          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          {isAuthenticated ? (
            <>
              <button className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted">
                <Bell className="h-5 w-5" />
              </button>

              <Link href="/write">
                <Button size="sm" variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground">
                  <PenLine className="h-4 w-4" />
                  Write
                </Button>
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="ml-1">
                    <Avatar className="h-8 w-8 cursor-pointer ring-2 ring-transparent hover:ring-muted transition-all">
                      <AvatarImage src={user?.avatar_url} alt={user?.display_name} />
                      <AvatarFallback className="text-xs">{getInitials(user?.display_name || "U")}</AvatarFallback>
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
                    <Link href={`/@${user?.username}`} className="cursor-pointer">
                      <FileText className="mr-2 h-4 w-4" />
                      Stories
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings/api-keys" className="cursor-pointer">
                      <Key className="mr-2 h-4 w-4" />
                      API Keys
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
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
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  Sign in
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="rounded-full px-4">Get started</Button>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Menu Button */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 text-muted-foreground"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button
            className="p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t bg-background animate-slide-up">
          <div className="container mx-auto px-4 py-4 space-y-1">
            <Link
              href="/feed"
              className="block px-3 py-2 text-sm font-medium hover:bg-muted rounded-lg"
              onClick={() => setMobileMenuOpen(false)}
            >
              Feed
            </Link>
            <Link
              href="/discover"
              className="block px-3 py-2 text-sm font-medium hover:bg-muted rounded-lg"
              onClick={() => setMobileMenuOpen(false)}
            >
              Discover
            </Link>

            {isAuthenticated ? (
              <>
                <Link
                  href="/write"
                  className="block px-3 py-2 text-sm font-medium hover:bg-muted rounded-lg"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Write
                </Link>
                <Link
                  href={`/@${user?.username}`}
                  className="block px-3 py-2 text-sm font-medium hover:bg-muted rounded-lg"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Profile
                </Link>
                <div className="border-t my-2" />
                <button
                  onClick={() => { logout(); setMobileMenuOpen(false); }}
                  className="block w-full text-left px-3 py-2 text-sm font-medium text-destructive hover:bg-muted rounded-lg"
                >
                  Sign out
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2 pt-2 border-t mt-2">
                <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" className="w-full">Sign in</Button>
                </Link>
                <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full">Get started</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
