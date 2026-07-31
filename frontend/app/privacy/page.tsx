import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="container mx-auto px-4 py-12 max-w-3xl flex-1">
        <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: {new Date().getFullYear()}</p>

        <div className="prose prose-lg dark:prose-invert max-w-none space-y-6">
          <section>
            <h2>1. Information We Collect</h2>
            <p>When you use IndieStack, we may collect:</p>
            <ul>
              <li><strong>Account information:</strong> name, email address, username, and profile details you provide</li>
              <li><strong>Content:</strong> posts, comments, and other content you publish</li>
              <li><strong>Usage data:</strong> pages visited, interactions, and reading behavior</li>
              <li><strong>Technical data:</strong> IP address, browser type, device information</li>
            </ul>
          </section>

          <section>
            <h2>2. How We Use Your Information</h2>
            <p>We use the collected information to:</p>
            <ul>
              <li>Provide, maintain, and improve the Platform</li>
              <li>Personalize your feed and recommendations</li>
              <li>Send notifications about interactions with your content</li>
              <li>Analyze usage patterns to improve our services</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2>3. Data Sharing</h2>
            <p>
              We do not sell your personal information. We may share data with service providers
              who help us operate the Platform (hosting, analytics, email delivery). These providers
              are contractually bound to protect your data.
            </p>
          </section>

          <section>
            <h2>4. Cookies</h2>
            <p>
              We use essential cookies for authentication and security. We may also use analytics
              cookies to understand how the Platform is used. You can control cookie preferences
              through your browser settings.
            </p>
          </section>

          <section>
            <h2>5. Data Security</h2>
            <p>
              We implement reasonable security measures to protect your data, including encryption
              in transit (HTTPS) and at rest. However, no method of electronic storage is 100% secure.
            </p>
          </section>

          <section>
            <h2>6. Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li>Access and download your data</li>
              <li>Correct inaccurate information</li>
              <li>Delete your account and associated data</li>
              <li>Opt out of non-essential communications</li>
            </ul>
          </section>

          <section>
            <h2>7. Contact</h2>
            <p>
              For privacy-related inquiries, contact us at{" "}
              <a href="mailto:privacy@indiestack.local" className="text-primary hover:underline">
                privacy@indiestack.local
              </a>.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
