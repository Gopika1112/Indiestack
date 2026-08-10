"use client";


const ENDPOINTS = [
  {
    section: "Authentication",
    endpoints: [
      { method: "POST", path: "/api/v1/auth/register", auth: "None", desc: "Create a new account (email, username, password, display_name). Returns the user and JWT tokens." },
      { method: "POST", path: "/api/v1/auth/login", auth: "None", desc: "Login with email + password. Returns the user and access/refresh tokens. Rate-limited." },
      { method: "POST", path: "/api/v1/auth/refresh", auth: "None", desc: "Exchange a refresh token for a new access token." },
      { method: "POST", path: "/api/v1/auth/logout", auth: "JWT", desc: "Stateless logout (client discards tokens)." },
      { method: "GET", path: "/api/v1/auth/me", auth: "JWT / API Key (profile:read)", desc: "Get the current authenticated user's profile." },
    ],
  },
  {
    section: "Posts",
    endpoints: [
      { method: "POST", path: "/api/v1/posts/", auth: "JWT / API Key (posts:write)", desc: "Create a post (title, TipTap content JSON, excerpt, tags[], cover_image_url, slug, status). Excerpt is auto-generated from the body if omitted." },
      { method: "GET", path: "/api/v1/posts/slug/:username/:slug", auth: "None", desc: "Get a single published post (full TipTap content, tags, counts). Also records a view for trending." },
      { method: "GET", path: "/api/v1/posts/:id/related", auth: "None", desc: "Related posts ranked by shared tags then full-text (tsvector) similarity." },
      { method: "GET", path: "/api/v1/posts/mine", auth: "JWT / API Key (posts:read)", desc: "List your own posts (drafts + published), newest first." },
      { method: "PUT", path: "/api/v1/posts/:id", auth: "JWT / API Key (posts:write)", desc: "Update your post (partial). Changing content regenerates the excerpt if none is supplied; slug is unchanged." },
      { method: "DELETE", path: "/api/v1/posts/:id", auth: "JWT / API Key (posts:write)", desc: "Archive your post (soft delete via status='archived')." },
    ],
  },
  {
    section: "Feed & Discovery",
    endpoints: [
      { method: "GET", path: "/api/v1/feed", auth: "None", desc: "Main feed (currently the latest published posts)." },
      { method: "GET", path: "/api/v1/feed/latest", auth: "None", desc: "Latest published posts, newest first." },
      { method: "GET", path: "/api/v1/feed/trending", auth: "None", desc: "Trending posts by all-time engagement (likes + comments + reposts)." },
      { method: "GET", path: "/api/v1/feed/trending-posts", auth: "None", desc: "Most-viewed posts in the last 24 hours (from the post_views event log); falls back to engagement ordering when empty." },
      { method: "GET", path: "/api/v1/feed/trending-topics", auth: "None", desc: "Hottest tags by recent views; falls back to overall tag usage." },
      { method: "GET", path: "/api/v1/feed/by-tag?tag=X", auth: "None", desc: "Published posts that have a given tag (case-insensitive)." },
      { method: "GET", path: "/api/v1/feed/following-topics", auth: "JWT", desc: "Posts from topics you follow; falls back to all posts when none are followed or matched." },
      { method: "GET", path: "/api/v1/search?q=X", auth: "None", desc: "Full-text search across title, excerpt, body content, and tags." },
      { method: "GET", path: "/api/v1/tags", auth: "None", desc: "Distinct tags across published posts, with usage counts." },
    ],
  },
  {
    section: "Topics",
    endpoints: [
      { method: "GET", path: "/api/v1/topics/following", auth: "JWT", desc: "List the topic tags you follow." },
      { method: "POST", path: "/api/v1/topics/follow", auth: "JWT", desc: "Follow a topic tag. Body: { \"tag\": \"Technology\" }." },
      { method: "DELETE", path: "/api/v1/topics/follow", auth: "JWT", desc: "Unfollow a topic tag. Body: { \"tag\": \"Technology\" }." },
    ],
  },
  {
    section: "Users & Profiles",
    endpoints: [
      { method: "GET", path: "/api/v1/users/:username", auth: "None", desc: "Get a user's public profile (overlays the profiles table)." },
      { method: "GET", path: "/api/v1/users/:username/posts", auth: "None", desc: "List a user's published posts." },
      { method: "GET", path: "/api/v1/profiles/:userId", auth: "JWT", desc: "Get a profile record by user id." },
      { method: "PUT", path: "/api/v1/profiles/:userId", auth: "JWT", desc: "Create/update your profile (name, headline, bio, website, location)." },
      { method: "POST", path: "/api/v1/follow", auth: "JWT", desc: "Follow a user. Body: { \"following_id\": \"<user_id>\" }." },
      { method: "DELETE", path: "/api/v1/follow", auth: "JWT", desc: "Unfollow a user." },
      { method: "GET", path: "/api/v1/stats", auth: "JWT", desc: "Your writer stats (post count, total views, likes, follower count)." },
      { method: "GET", path: "/api/v1/earnings", auth: "JWT", desc: "Your total tips received." },
    ],
  },
  {
    section: "Social",
    endpoints: [
      { method: "POST", path: "/api/v1/likes", auth: "JWT", desc: "Like a post. Body: { \"post_id\": \"<id>\" }." },
      { method: "DELETE", path: "/api/v1/likes", auth: "JWT", desc: "Unlike a post (?post_id=)." },
      { method: "GET", path: "/api/v1/comments", auth: "None", desc: "List comments for a post (?post_id=)." },
      { method: "POST", path: "/api/v1/comments", auth: "JWT", desc: "Add a comment (supports threaded replies via parent_id)." },
      { method: "POST", path: "/api/v1/reposts", auth: "JWT", desc: "Repost a post to your followers." },
      { method: "DELETE", path: "/api/v1/reposts", auth: "JWT", desc: "Remove a repost (?post_id=)." },
      { method: "GET", path: "/api/v1/mutes", auth: "JWT", desc: "List authors you have muted." },
      { method: "POST", path: "/api/v1/mutes", auth: "JWT", desc: "Mute an author (hides their posts from your feeds)." },
      { method: "DELETE", path: "/api/v1/mutes", auth: "JWT", desc: "Unmute an author (?user_id=)." },
    ],
  },
  {
    section: "Bookmarks, History & Notifications",
    endpoints: [
      { method: "GET", path: "/api/v1/bookmarks", auth: "JWT", desc: "List your bookmarked posts." },
      { method: "POST", path: "/api/v1/bookmarks", auth: "JWT", desc: "Bookmark a post. Body: { \"post_id\": \"<id>\" }." },
      { method: "DELETE", path: "/api/v1/bookmarks", auth: "JWT", desc: "Remove a bookmark (?post_id=)." },
      { method: "GET", path: "/api/v1/history", auth: "JWT", desc: "Your reading history (with author username), most recent first." },
      { method: "POST", path: "/api/v1/history", auth: "JWT", desc: "Record a read. Body: { \"post_id\": \"<id>\" }. Re-reads update the timestamp." },
      { method: "GET", path: "/api/v1/notifications", auth: "JWT", desc: "List your notifications." },
      { method: "PUT", path: "/api/v1/notifications", auth: "JWT", desc: "Mark all notifications as read." },
    ],
  },
  {
    section: "Settings",
    endpoints: [
      { method: "GET", path: "/api/v1/settings/account", auth: "JWT", desc: "Get account settings (email, username, phone, language, timezone)." },
      { method: "PUT", path: "/api/v1/settings/account", auth: "JWT", desc: "Update account settings (username/email uniqueness-checked). Also at /settings/profile." },
      { method: "GET", path: "/api/v1/settings/public-profile", auth: "JWT", desc: "Get public profile settings (display name, cover, short bio, social links, visibility)." },
      { method: "PUT", path: "/api/v1/settings/public-profile", auth: "JWT", desc: "Update public profile settings." },
      { method: "GET", path: "/api/v1/settings/security", auth: "JWT", desc: "Get security settings (2FA flag, recovery email)." },
      { method: "PUT", path: "/api/v1/settings/security", auth: "JWT", desc: "Update security settings." },
      { method: "POST", path: "/api/v1/settings/change-password", auth: "JWT", desc: "Change password (verifies current). Invalidates other sessions." },
      { method: "GET", path: "/api/v1/settings/sessions", auth: "JWT", desc: "List your active sessions / connected devices." },
      { method: "DELETE", path: "/api/v1/settings/sessions/:id", auth: "JWT", desc: "Revoke a single session." },
      { method: "POST", path: "/api/v1/settings/sessions/revoke-all", auth: "JWT", desc: "Log out from all devices." },
      { method: "GET", path: "/api/v1/settings/notifications", auth: "JWT", desc: "Get notification preferences (email + push toggles)." },
      { method: "PUT", path: "/api/v1/settings/notifications", auth: "JWT", desc: "Update notification preferences." },
      { method: "GET", path: "/api/v1/settings/privacy", auth: "JWT", desc: "Get privacy settings." },
      { method: "PUT", path: "/api/v1/settings/privacy", auth: "JWT", desc: "Update privacy settings." },
      { method: "GET", path: "/api/v1/settings/writing", auth: "JWT", desc: "Get writing preferences." },
      { method: "PUT", path: "/api/v1/settings/writing", auth: "JWT", desc: "Update writing preferences." },
      { method: "GET", path: "/api/v1/settings/reading", auth: "JWT", desc: "Get reading preferences." },
      { method: "PUT", path: "/api/v1/settings/reading", auth: "JWT", desc: "Update reading preferences." },
      { method: "GET", path: "/api/v1/settings/email", auth: "JWT", desc: "Get email preferences (frequency + subscriptions)." },
      { method: "PUT", path: "/api/v1/settings/email", auth: "JWT", desc: "Update email preferences." },
      { method: "GET", path: "/api/v1/settings/connected-accounts", auth: "JWT", desc: "List connected social accounts." },
      { method: "POST", path: "/api/v1/settings/connected-accounts", auth: "JWT", desc: "Connect a provider (google, github, apple, discord, linkedin, twitter)." },
      { method: "DELETE", path: "/api/v1/settings/connected-accounts/:provider", auth: "JWT", desc: "Disconnect a provider." },
      { method: "GET", path: "/api/v1/settings/export-data", auth: "JWT", desc: "Download your data (user + posts) as JSON." },
      { method: "POST", path: "/api/v1/settings/deactivate-account", auth: "JWT", desc: "Deactivate your account (reversible)." },
      { method: "DELETE", path: "/api/v1/settings/delete-account", auth: "JWT", desc: "Permanently delete your account and data." },
      { method: "POST", path: "/api/v1/settings/remove-all-stories", auth: "JWT", desc: "Archive all your stories." },
    ],
  },
  {
    section: "API Keys",
    endpoints: [
      { method: "POST", path: "/api/v1/api-keys", auth: "JWT only", desc: "Create an API key with scoped permissions (max 10 active). Returns the raw key once — store it securely." },
      { method: "GET", path: "/api/v1/api-keys", auth: "JWT only", desc: "List your API keys (prefix + scopes, never the raw key)." },
      { method: "DELETE", path: "/api/v1/api-keys/:id", auth: "JWT only", desc: "Revoke/delete an API key." },
    ],
  },
  {
    section: "Other",
    endpoints: [
      { method: "POST", path: "/api/v1/upload", auth: "JWT / API Key", desc: "Upload an image (multipart, field 'file', max 10MB). Returns a relative /uploads/... URL." },
      { method: "POST", path: "/api/v1/avatars/upload", auth: "JWT", desc: "Upload a profile avatar (multipart, field 'avatar', max 5MB)." },
      { method: "POST", path: "/api/v1/newsletter", auth: "None", desc: "Subscribe an email to the newsletter." },
      { method: "GET", path: "/api/v1/jobs", auth: "None", desc: "List open jobs." },
      { method: "POST", path: "/api/v1/jobs", auth: "JWT", desc: "Post a new job." },
      { method: "GET", path: "/api/v1/health", auth: "None", desc: "API health check." },
      { method: "GET", path: "/api/v1/ready", auth: "None", desc: "Readiness check (database connectivity)." },
    ],
  },
];

const SCOPES = [
  { scope: "posts:read", desc: "Read your posts and drafts" },
  { scope: "posts:write", desc: "Create, update, and delete posts" },
  { scope: "profile:read", desc: "Read your profile information" },
  { scope: "profile:write", desc: "Update your profile" },
  { scope: "feed:read", desc: "Access feed and trending content" },
];

// Turn a section title into a URL-safe anchor id.
function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Build the left-nav items: the static intro sections plus every endpoint section.
const NAV_ITEMS = [
  { id: "authentication", label: "Authentication" },
  { id: "scopes", label: "API Key Scopes" },
  ...ENDPOINTS.map((s) => ({ id: slugify(s.section), label: s.section })),
  { id: "examples", label: "Examples" },
  { id: "response-format", label: "Response Format" },
];

export default function APIDocsPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="container mx-auto px-4 py-10 max-w-[1100px] flex-1 w-full">
        <h1 className="text-3xl font-bold mb-2">API Documentation</h1>
        <p className="text-muted-foreground mb-10">
          IndieStack is API-first. Use JWT tokens or API keys to access all features programmatically.
        </p>

        <div className="lg:flex lg:gap-10">
          {/* Left navigation panel — sticky on desktop */}
          <nav className="hidden lg:block lg:w-56 lg:shrink-0">
            <div className="lg:sticky lg:top-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-3">
                On this page
              </p>
              <ul className="space-y-0.5">
                {NAV_ITEMS.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className="block rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          {/* Docs content */}
          <div className="flex-1 min-w-0 max-w-[780px]">
        {/* Authentication */}
        <section id="authentication" className="mb-12 scroll-mt-24">
          <h2 className="text-2xl font-semibold mb-4">Authentication</h2>
          <p className="text-muted-foreground mb-4">
            IndieStack supports two authentication methods. Both use the <code className="bg-muted px-1.5 py-0.5 rounded text-sm">Authorization</code> header.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 mb-6">
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-1">JWT Token</h3>
              <p className="text-sm text-muted-foreground mb-3">Full access. Obtained via login/register.</p>
              <code className="text-xs bg-muted px-2 py-1 rounded block">Authorization: Bearer eyJhbG...</code>
            </div>
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-1">API Key</h3>
              <p className="text-sm text-muted-foreground mb-3">Scoped access. Created in settings.</p>
              <code className="text-xs bg-muted px-2 py-1 rounded block">Authorization: Bearer isk_a1b2c3...</code>
            </div>
          </div>
        </section>

        {/* Scopes */}
        <section id="scopes" className="mb-12 scroll-mt-24">
          <h2 className="text-2xl font-semibold mb-4">API Key Scopes</h2>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Scope</th>
                  <th className="text-left px-4 py-2 font-medium">Access</th>
                </tr>
              </thead>
              <tbody>
                {SCOPES.map((s) => (
                  <tr key={s.scope} className="border-t">
                    <td className="px-4 py-2 font-mono text-xs">{s.scope}</td>
                    <td className="px-4 py-2 text-muted-foreground">{s.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Endpoints */}
        {ENDPOINTS.map((section) => (
          <section key={section.section} id={slugify(section.section)} className="mb-12 scroll-mt-24">
            <h2 className="text-2xl font-semibold mb-4">{section.section}</h2>
            <div className="space-y-3">
              {section.endpoints.map((ep) => (
                <div key={ep.method + ep.path} className="border rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                      ep.method === "GET" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                      : ep.method === "POST" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                      : ep.method === "PUT" ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                      : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                    }`}>
                      {ep.method}
                    </span>
                    <code className="text-sm font-mono">{ep.path}</code>
                  </div>
                  <p className="text-sm text-muted-foreground">{ep.desc}</p>
                  <p className="text-xs text-muted-foreground mt-1">Auth: {ep.auth}</p>
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* Examples */}
        <section id="examples" className="mb-12 scroll-mt-24">
          <h2 className="text-2xl font-semibold mb-4">Examples</h2>

          <div className="space-y-6">
            <div>
              <h3 className="font-medium mb-2">Create a post via API key</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
{`curl -X POST https://your-domain/api/v1/posts/ \\
  -H "Authorization: Bearer isk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "My Post via API",
    "slug": "my-api-post",
    "content": {
      "type": "doc",
      "content": [{
        "type": "paragraph",
        "content": [{"type": "text", "text": "Hello from AI!"}]
      }]
    },
    "excerpt": "Posted via API",
    "status": "published"
  }'`}
              </pre>
            </div>

            <div>
              <h3 className="font-medium mb-2">List your posts</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
{`curl https://your-domain/api/v1/posts/mine \\
  -H "Authorization: Bearer isk_your_key_here"`}
              </pre>
            </div>

            <div>
              <h3 className="font-medium mb-2">Login and get JWT token</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
{`curl -X POST https://your-domain/api/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "you@example.com", "password": "your-password"}'`}
              </pre>
            </div>
          </div>
        </section>

        {/* Response Format */}
        <section id="response-format" className="mb-12 scroll-mt-24">
          <h2 className="text-2xl font-semibold mb-4">Response Format</h2>
          <p className="text-muted-foreground mb-4">All responses follow this structure:</p>
          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
{`{
  "success": true,
  "data": { ... }
}

// Error response:
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}`}
          </pre>
        </section>
          </div>
        </div>
      </main>
    </div>
  );
}
