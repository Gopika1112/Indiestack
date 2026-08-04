"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "@/lib/auth-store";
import {
  User,
  Globe,
  ShieldCheck,
  Bell,
  Lock,
  PenLine,
  Link2,
  BookOpen,
  Mail,
  AlertTriangle,
} from "lucide-react";

const SECTIONS = [
  { href: "/settings/account", label: "Account", icon: User },
  { href: "/settings/public-profile", label: "Public Profile", icon: Globe },
  { href: "/settings/security", label: "Security", icon: ShieldCheck },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
  { href: "/settings/privacy", label: "Privacy", icon: Lock },
  { href: "/settings/writing", label: "Writing", icon: PenLine },
  { href: "/settings/connected", label: "Connected Accounts", icon: Link2 },
  { href: "/settings/reading", label: "Reading", icon: BookOpen },
  { href: "/settings/email", label: "Email", icon: Mail },
  { href: "/settings/danger", label: "Danger Zone", icon: AlertTriangle },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 max-w-[1100px]">
        <h1 className="text-3xl font-bold mb-1">Settings</h1>
        <p className="text-muted-foreground mb-8">Manage your account and preferences.</p>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Section nav */}
          <nav className="md:w-60 shrink-0">
            <ul className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
              {SECTIONS.map((s) => {
                const active = pathname === s.href || pathname.startsWith(s.href + "/");
                return (
                  <li key={s.href} className="shrink-0">
                    <Link
                      href={s.href}
                      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors ${
                        active
                          ? "bg-muted font-medium text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      } ${s.href === "/settings/danger" && active ? "text-destructive" : ""}`}
                    >
                      <s.icon className="h-4 w-4 shrink-0" />
                      {s.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Section content */}
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </main>
    </div>
  );
}
