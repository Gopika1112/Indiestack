import { Footer } from "@/components/footer";

const SECTIONS = [
  {
    title: "1. Information We Collect",
    content:
      "When you use IndieStack, we may collect account information (name, email, username, profile details), content you publish (posts, comments), usage data (pages visited, interactions, reading behavior), and technical data (IP address, browser type, device information).",
  },
  {
    title: "2. How We Use Your Information",
    content:
      "We use the collected information to provide, maintain, and improve the Platform; personalize your feed and recommendations; send notifications about interactions with your content; analyze usage patterns to improve our services; and comply with legal obligations.",
  },
  {
    title: "3. Data Sharing",
    content:
      "We do not sell your personal information. We may share data with service providers who help us operate the Platform (hosting, analytics, email delivery). These providers are contractually bound to protect your data.",
  },
  {
    title: "4. Cookies",
    content:
      "We use essential cookies for authentication and security. We may also use analytics cookies to understand how the Platform is used. You can control cookie preferences through your browser settings.",
  },
  {
    title: "5. Data Security",
    content:
      "We implement reasonable security measures to protect your data, including encryption in transit (HTTPS) and at rest. However, no method of electronic storage is 100% secure.",
  },
  {
    title: "6. Your Rights",
    content:
      "You have the right to access and download your data, correct inaccurate information, delete your account and associated data, and opt out of non-essential communications.",
  },
  {
    title: "7. Contact",
    content:
      "For privacy-related inquiries, contact us at privacy@indiestack.local.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="container mx-auto px-4 py-16 max-w-[680px] flex-1">
        <h1 className="text-4xl font-bold tracking-tight mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-muted-foreground mb-12">
          Last updated: {new Date().getFullYear()}
        </p>

        <div className="space-y-10">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-semibold mb-3">{section.title}</h2>
              <p className="text-muted-foreground leading-relaxed text-sm">
                {section.content}
              </p>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
