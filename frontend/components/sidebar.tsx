"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebarStore } from "@/lib/sidebar-store";
import { useAuthStore } from "@/lib/auth-store";
import { notificationsAPI } from "@/lib/api";
import {
  Home,
  Compass,
  Bookmark,
  Clock,
  Search,
  FileText,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  BookOpen,
  List,
  Bell,
  Flag,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";

const NAV_SECTIONS = [
  {
    label: "Browse",
    items: [
      { href: "/feed", label: "Home", icon: Home },
      { href: "/discover", label: "Explore", icon: Compass },
      { href: "/search", label: "Search", icon: Search },
    ],
  },
  {
    label: "Communities",
    items: [
      { href: "/publications", label: "Publications", icon: BookOpen },
      { href: "/lists", label: "Lists", icon: List },
    ],
  },
  {
    label: "Library",
    items: [
      { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
      { href: "/history", label: "History", icon: Clock },
      { href: "/dashboard/drafts", label: "Drafts", icon: FileText },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/moderation", label: "Moderation", icon: Flag },
    ],
  },
];

// NavLink renders a single sidebar link with consistent styling.
function NavLink({
  item,
  collapsed,
  isActive,
  onNavigate,
  badge,
}: {
  item: { href: string; label: string; icon: React.ComponentType<any> };
  collapsed: boolean;
  isActive: (href: string) => boolean;
  onNavigate: () => void;
  badge?: number;
}) {
  const active = isActive(item.href);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={`
        group flex items-center gap-4 px-3 py-2.5 rounded-md text-[15px] whitespace-nowrap
        transition-colors
        ${collapsed ? "lg:justify-center lg:px-0" : ""}
        ${active ? "text-foreground font-medium bg-muted/50" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"}
      `}
    >
      <span className="relative shrink-0">
        <item.icon
          className={`h-[22px] w-[22px] transition-colors ${
            active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
          }`}
          strokeWidth={active ? 2.2 : 1.8}
        />
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-4 px-0.5 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
    </Link>
  );
}

export function Sidebar() {
  const { collapsed, toggle } = useSidebarStore();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { isAuthenticated } = useAuthStore();
  const [unreadCount, setUnreadCount] = useState(0);

  // Poll unread notification count every 30s and on mount.
  useEffect(() => {
    if (!isAuthenticated) return;
    const load = () => {
      notificationsAPI
        .list()
        .then((res) => {
          const unread = (res.data || []).filter((n) => !n.read).length;
          setUnreadCount(unread);
        })
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

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
          <Link href="/feed" className="flex items-center gap-2.5 min-w-0" onClick={() => setMobileOpen(false)}>
            <div className="h-9 w-9 rounded-full bg-foreground flex items-center justify-center shrink-0">
              <span className="text-background font-bold text-base">I</span>
            </div>
            <span className={`text-xl font-bold tracking-tight whitespace-nowrap ${collapsed ? "hidden" : ""}`}>
              IndieStack
            </span>
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

        {/* Expand button when collapsed (desktop) — centered below logo */}
        {collapsed && (
          <div className="hidden lg:flex justify-center pt-1 shrink-0">
            <button
              onClick={toggle}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="h-5 w-5" strokeWidth={1.8} />
            </button>
          </div>
        )}

        {/* Nav links — grouped into labeled sections */}
        <nav className={`flex-1 pt-4 space-y-5 overflow-y-auto overflow-x-hidden ${collapsed ? "lg:px-3" : "px-4"}`}>
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              {!collapsed && (
                <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink key={item.href} item={item} collapsed={collapsed} isActive={isActive} onNavigate={() => setMobileOpen(false)} />
                ))}
              </div>
            </div>
          ))}

          {/* Notifications — auth only, in Library section */}
          {isAuthenticated && (
            <div>
              {!collapsed && (
                <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Account
                </p>
              )}
              <div className="space-y-0.5">
                <NavLink
                  item={{ href: "/notifications", label: "Notifications", icon: Bell }}
                  collapsed={collapsed}
                  isActive={isActive}
                  onNavigate={() => setMobileOpen(false)}
                  badge={unreadCount}
                />
              </div>
            </div>
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
      </aside>
    </>
  );
}
