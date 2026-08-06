import Link from "next/link";
import { PenLine, Users, TrendingUp, Globe, Zap, Shield } from "lucide-react";

const FEATURES = [
  {
    icon: PenLine,
    title: "Rich Text Editor",
    description: "A powerful editor with markdown support, embeds, and formatting — write without friction.",
  },
  {
    icon: Users,
    title: "Build Your Audience",
    description: "Grow your following with newsletters, social features, and discovery tools.",
  },
  {
    icon: TrendingUp,
    title: "Analytics & Insights",
    description: "Understand your readers with detailed stats on views, reads, and engagement.",
  },
  {
    icon: Zap,
    title: "Monetization",
    description: "Earn from your writing through tips, paid subscriptions, and the partner program.",
  },
  {
    icon: Globe,
    title: "Built for India",
    description: "Fast on 4G, UPI payments, and regional language support — optimized for Indian readers.",
  },
  {
    icon: Shield,
    title: "You Own Your Content",
    description: "You retain full ownership of everything you publish. No exclusivity, no lock-in.",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="container mx-auto px-4 py-16 max-w-[680px] flex-1">
        {/* Hero */}
        <div className="mb-16">
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Every story matters
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-lg">
            IndieStack is India&apos;s publishing platform for writers, thinkers, and creators.
            We provide the tools to write, grow your audience, and earn from your work — all in one place.
          </p>
        </div>

        {/* Mission */}
        <div className="mb-16">
          <h2 className="text-xl font-semibold mb-4">Our mission</h2>
          <p className="text-muted-foreground leading-relaxed">
            We believe every voice deserves to be heard. The internet promised democratized publishing,
            but most platforms are optimized for advertisers, not writers. IndieStack puts creators first —
            giving you ownership, reach, and the ability to make a living from your craft.
          </p>
        </div>

        {/* Features grid */}
        <div className="mb-16">
          <h2 className="text-xl font-semibold mb-6">What we offer</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="flex gap-3">
                <feature.icon className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-sm mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="border-t pt-8">
          <p className="text-muted-foreground text-sm leading-relaxed">
            Ready to start writing?{" "}
            <Link href="/write" className="text-primary hover:underline font-medium">
              Create your first post
            </Link>{" "}
            or{" "}
            <Link href="/feed" className="text-primary hover:underline font-medium">
              explore what others are writing
            </Link>.
          </p>
        </div>
      </main>
    </div>
  );
}
