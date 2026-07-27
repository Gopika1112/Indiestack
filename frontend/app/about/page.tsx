export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-4">About Penmark</h1>
      <p className="text-lg text-muted-foreground mb-6">Penmark is India's publishing platform for writers, thinkers, and creators.</p>
      <div className="prose prose-lg">
        <p>We believe every voice deserves to be heard. Penmark provides the tools for writers to publish, grow their audience, and earn from their work.</p>
        <h2>Features</h2>
        <ul>
          <li>Rich text editor with markdown support</li>
          <li>Newsletter tools to reach your subscribers</li>
          <li>Analytics to understand your audience</li>
          <li>Monetization through tips and paid subscriptions</li>
          <li>Job board for the writing community</li>
        </ul>
        <h2>Built for India</h2>
        <p>Optimized for Indian readers — fast on 4G, UPI payments, regional language support coming soon.</p>
      </div>
    </div>
  );
}
