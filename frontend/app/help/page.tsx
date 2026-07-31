import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { HelpCircle, BookOpen, Mail, MessageCircle, FileText, Key } from "lucide-react";

const HELP_SECTIONS = [
  {
    icon: BookOpen,
    title: "Getting Started",
    description: "Learn the basics of writing, publishing, and building your audience on IndieStack.",
    links: [
      { label: "How to write your first post", href: "/write" },
      { label: "Understanding the editor", href: "/write" },
      { label: "Publishing and drafts", href: "/dashboard/drafts" },
    ],
  },
  {
    icon: FileText,
    title: "Content & Publishing",
    description: "Tips for creating great content and reaching more readers.",
    links: [
      { label: "Formatting guide", href: "/write" },
      { label: "SEO best practices", href: "/write" },
      { label: "Adding images and media", href: "/write" },
    ],
  },
  {
    icon: Key,
    title: "Account & API",
    description: "Manage your account settings and programmatic access.",
    links: [
      { label: "API documentation", href: "/docs/api" },
      { label: "Managing API keys", href: "/settings/api-keys" },
      { label: "Account settings", href: "/settings" },
    ],
  },
  {
    icon: MessageCircle,
    title: "Community & Support",
    description: "Get help from the community or reach out to our support team.",
    links: [
      { label: "Community guidelines", href: "/terms" },
      { label: "Report an issue", href: "mailto:support@indiestack.local" },
      { label: "Feature requests", href: "mailto:feedback@indiestack.local" },
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="container mx-auto px-4 py-12 max-w-4xl flex-1">
        <div className="text-center mb-12">
          <HelpCircle className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <h1 className="text-4xl font-bold mb-2">Help Center</h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Find answers to common questions and learn how to get the most out of IndieStack.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {HELP_SECTIONS.map((section) => (
            <div
              key={section.title}
              className="border rounded-xl p-6 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <section.icon className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-lg">{section.title}</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">{section.description}</p>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-primary hover:underline"
                    >
                      {link.label} &rarr;
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="text-center border-t pt-8">
          <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2">
            <Mail className="h-4 w-4" />
            <span>Still need help?</span>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Email us at{" "}
            <a href="mailto:support@indiestack.local" className="text-primary hover:underline">
              support@indiestack.local
            </a>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
