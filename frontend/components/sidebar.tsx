"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { useSidebarStore } from "@/lib/sidebar-store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PenLine,
  Home,
  Compass,
  Bookmark,
  Clock,
  Bell,
  Search,
  Settings,
  LogOut,
  LogIn,
  User,
  FileText,
  Key,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
} from "lucide-react";
import { useState } from "react";
import { useTheme } from "next-themes";
import { getInitials } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/feed", label: "Home", icon: Home },
  { href: "/discover", label: "Explore", icon: Compass },
  { href: "/search", label: "Search", icon: Search },
  { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/history", label: "History", icon: Clock },
  { href: "/dashboard/drafts", label: "Drafts", icon: FileText },
];

export function Sidebar() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const { collapsed, toggle } = useSidebarStore();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  const isActive = (href: string) => {
    if (href === "/feed") return pathname === "/feed" || pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="fixed top-3 left-3 z-50 lg:hidden p-2 rounded-full bg-background border shadow-sm"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-40 h-full bg-background border-r border-border/60 flex flex-col
          transition-[width,transform] duration-200 ease-in-out overflow-hidden
          lg:translate-x-0
          ${collapsed ? "lg:w-[72px]" : "lg:w-[260px]"}
          w-[260px]
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Logo + collapse toggle */}
        <div className={`h-16 flex items-center shrink-0 ${collapsed ? "lg:justify-center lg:px-0" : "justify-between px-6"}`}>
          <Link href="/" className="flex items-center gap-2.5 min-w-0" onClick={() => setMobileOpen(false)}>
            <div className="h-8 w-8 rounded-full bg-foreground flex items-center justify-center shrink-0">
              <span className="text-background font-bold text-sm">I</span>
            </div>
            {!collapsed && (
              <span className="text-xl font-bold tracking-tight whitespace-nowrap">IndieStack</span>
            )}
          </Link>
          {!collapsed && (
            <button
              onClick={toggle}
              className="hidden lg:flex p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="h-5 w-5" strokeWidth={1.8} />
            </button>
          )}
        </div>

        {/* Expand button when collapsed (desktop) */}
        {collapsed && (
          <div className="hidden lg:flex justify-center pt-2 shrink-0">
            <button
              onClick={toggle}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="h-5 w-5" strokeWidth={1.8} />
            </button>
          </div>
        )}

        {/* Nav links */}
        <nav className={`flex-1 pt-6 space-y-1 overflow-y-auto overflow-x-hidden ${collapsed ? "lg:px-3" : "px-4"}`}>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? item.label : undefined}
              className={`
                group flex items-center gap-4 px-3 py-2.5 rounded-md text-[15px] whitespace-nowrap
                transition-colors
                ${collapsed ? "lg:justify-center lg:px-0" : ""}
                ${isActive(item.href)
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
                }
              `}
            >
              <item.icon
                className={`h-[22px] w-[22px] shrink-0 transition-colors ${
                  isActive(item.href) ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                }`}
                strokeWidth={isActive(item.href) ? 2.2 : 1.8}
              />
              <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
            </Link>
          ))}

          {/* Notifications - only for authenticated users */}
          {isAuthenticated && (
            <Link
              href="/notifications"
              onClick={() => setMobileOpen(false)}
              title={collapsed ? "Notifications" : undefined}
              className={`
                group flex items-center gap-4 px-3 py-2.5 rounded-md text-[15px] whitespace-nowrap
                transition-colors
                ${collapsed ? "lg:justify-center lg:px-0" : ""}
                ${isActive("/notifications")
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
                }
              `}
            >
              <Bell
                className={`h-[22px] w-[22px] shrink-0 transition-colors ${
                  isActive("/notifications") ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                }`}
                strokeWidth={isActive("/notifications") ? 2.2 : 1.8}
              />
              <span className={collapsed ? "lg:hidden" : ""}>Notifications</span>
            </Link>
          )}

          {/* Write link - Medium style: part of nav, not a button */}
          {isAuthenticated && (
            <Link
              href="/write"
              onClick={() => setMobileOpen(false)}
              title={collapsed ? "Write" : undefined}
              className={`
                group flex items-center gap-4 px-3 py-2.5 rounded-md text-[15px] whitespace-nowrap
                transition-colors
                ${collapsed ? "lg:justify-center lg:px-0" : ""}
                ${isActive("/write")
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
                }
              `}
            >
              <PenLine
                className={`h-[22px] w-[22px] shrink-0 transition-colors ${
                  isActive("/write") ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                }`}
                strokeWidth={isActive("/write") ? 2.2 : 1.8}
              />
              <span className={collapsed ? "lg:hidden" : ""}>Write</span>
            </Link>
          )}
        </nav>

        {/* Theme toggle */}
        <div className={`border-t border-border/60 py-3 shrink-0 ${collapsed ? "lg:flex lg:justify-center px-0" : "px-4"}`}>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={`flex items-center gap-3 rounded-md hover:bg-muted/40 transition-colors ${
              collapsed ? "lg:justify-center p-2 mx-auto" : "w-full px-3 py-2"
            }`}
            title={collapsed ? (theme === "dark" ? "Light mode" : "Dark mode") : undefined}
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            <span className={collapsed ? "lg:hidden" : ""}>
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </span>
          </button>
        </div>

        {/* Bottom section - only shown for authenticated users */}
        {isAuthenticated && (
          <div className={`border-t border-border/60 py-4 shrink-0 ${collapsed ? "lg:px-0 lg:flex lg:justify-center px-4" : "px-4"}`}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`flex items-center gap-3 rounded-md hover:bg-muted/40 transition-colors ${
                    collapsed ? "lg:justify-center lg:p-1.5 lg:w-auto w-full px-3 py-2.5" : "w-full px-3 py-2.5"
                  }`}
                  title={collapsed ? user?.display_name : undefined}
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={user?.avatar_url} alt={user?.display_name} />
                    <AvatarFallback className="text-xs">{getInitials(user?.display_name || "U")}</AvatarFallback>
                  </Avatar>
                  <div className={`text-left min-w-0 flex-1 ${collapsed ? "lg:hidden" : ""}`}>
                    <p className="text-sm font-medium truncate">{user?.display_name}</p>
                    <p className="text-xs text-muted-foreground truncate">@{user?.username}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="right" className="w-56">
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
          </div>
        )}

        {/* Bottom section - only shown for unauthenticated users */}
        {!isAuthenticated && (
          <div className={`border-t border-border/60 py-4 shrink-0 ${collapsed ? "lg:px-0 lg:flex lg:flex-col lg:items-center lg:gap-2 px-4" : "px-4 space-y-2"}`}>
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              title={collapsed ? "Sign in" : undefined}
              className={`flex items-center gap-3 rounded-md border border-border text-[15px] font-medium transition-colors hover:bg-muted/40 ${
                collapsed ? "lg:justify-center lg:p-2.5 lg:w-auto w-full px-3 py-2.5 justify-center" : "w-full px-3 py-2.5 justify-center"
              }`}
            >
              <LogIn className="h-[20px] w-[20px] shrink-0" />
              <span className={collapsed ? "lg:hidden" : ""}>Sign in</span>
            </Link>
            <Link
              href="/register"
              onClick={() => setMobileOpen(false)}
              title={collapsed ? "Get started" : undefined}
              className={`flex items-center gap-3 rounded-full bg-foreground text-background text-[15px] font-medium transition-colors hover:opacity-90 ${
                collapsed ? "lg:justify-center lg:p-2.5 lg:w-auto lg:rounded-md w-full px-3 py-2.5 justify-center" : "w-full px-3 py-2.5 justify-center"
              }`}
            >
              <PenLine className="h-[20px] w-[20px] shrink-0" />
              <span className={collapsed ? "lg:hidden" : ""}>Get started</span>
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
