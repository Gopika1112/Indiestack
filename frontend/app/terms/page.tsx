import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="container mx-auto px-4 py-12 max-w-3xl flex-1">
        <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: {new Date().getFullYear()}</p>

        <div className="prose prose-lg dark:prose-invert max-w-none space-y-6">
          <section>
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing or using IndieStack (&ldquo;the Platform&rdquo;), you agree to be bound by these Terms of Service.
              If you do not agree, please do not use the Platform.
            </p>
          </section>

          <section>
            <h2>2. User Accounts</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials and for all activities
              that occur under your account. You must provide accurate and complete information when creating an account.
            </p>
          </section>

          <section>
            <h2>3. Content</h2>
            <p>
              You retain ownership of the content you publish on IndieStack. By publishing, you grant us a non-exclusive,
              royalty-free license to display and distribute your content on the Platform. You are solely responsible for
              the content you publish and must ensure it does not violate any laws or third-party rights.
            </p>
          </section>

          <section>
            <h2>4. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul>
              <li>Publish content that is unlawful, harmful, threatening, abusive, harassing, defamatory, or otherwise objectionable</li>
              <li>Impersonate any person or entity</li>
              <li>Use the Platform for spam or unauthorized advertising</li>
              <li>Attempt to gain unauthorized access to any part of the Platform</li>
              <li>Interfere with or disrupt the Platform&apos;s servers or networks</li>
            </ul>
          </section>

          <section>
            <h2>5. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account at any time for violations of these Terms
              or for any other reason at our sole discretion.
            </p>
          </section>

          <section>
            <h2>6. Disclaimer</h2>
            <p>
              The Platform is provided &ldquo;as is&rdquo; without warranties of any kind, either express or implied.
              We do not guarantee that the Platform will be uninterrupted, secure, or error-free.
            </p>
          </section>

          <section>
            <h2>7. Contact</h2>
            <p>
              If you have questions about these Terms, please contact us at{" "}
              <a href="mailto:legal@indiestack.local" className="text-primary hover:underline">
                legal@indiestack.local
              </a>.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
