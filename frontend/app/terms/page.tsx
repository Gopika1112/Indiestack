
const SECTIONS = [
  {
    title: "1. Acceptance of Terms",
    content:
      'By accessing or using IndieStack ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Platform.',
  },
  {
    title: "2. User Accounts",
    content:
      "You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must provide accurate and complete information when creating an account.",
  },
  {
    title: "3. Content",
    content:
      "You retain ownership of the content you publish on IndieStack. By publishing, you grant us a non-exclusive, royalty-free license to display and distribute your content on the Platform. You are solely responsible for the content you publish and must ensure it does not violate any laws or third-party rights.",
  },
  {
    title: "4. Acceptable Use",
    content:
      "You agree not to publish content that is unlawful, harmful, threatening, abusive, harassing, defamatory, or otherwise objectionable; impersonate any person or entity; use the Platform for spam or unauthorized advertising; attempt to gain unauthorized access to any part of the Platform; or interfere with or disrupt the Platform's servers or networks.",
  },
  {
    title: "5. Termination",
    content:
      "We reserve the right to suspend or terminate your account at any time for violations of these Terms or for any other reason at our sole discretion.",
  },
  {
    title: "6. Disclaimer",
    content:
      'The Platform is provided "as is" without warranties of any kind, either express or implied. We do not guarantee that the Platform will be uninterrupted, secure, or error-free.',
  },
  {
    title: "7. Contact",
    content:
      "If you have questions about these Terms, please contact us at legal@indiestack.local.",
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="container mx-auto px-4 py-16 max-w-[680px] flex-1">
        <h1 className="text-4xl font-bold tracking-tight mb-2">
          Terms of Service
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
    </div>
  );
}
