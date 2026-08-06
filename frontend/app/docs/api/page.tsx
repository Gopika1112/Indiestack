"use client";


const ENDPOINTS = [
  {
    section: "Authentication",
    endpoints: [
      { method: "POST", path: "/api/v1/auth/register", auth: "None", desc: "Create a new account" },
      { method: "POST", path: "/api/v1/auth/login", auth: "None", desc: "Login and receive tokens" },
      { method: "GET", path: "/api/v1/auth/me", auth: "JWT / API Key (profile:read)", desc: "Get current user profile" },
      { method: "POST", path: "/api/v1/auth/refresh", auth: "None", desc: "Refresh access token" },
    ],
  },
  {
    section: "Posts",
    endpoints: [
      { method: "POST", path: "/api/v1/posts/", auth: "JWT / API Key (posts:write)", desc: "Create a new post" },
      { method: "GET", path: "/api/v1/posts/slug/:username/:slug", auth: "None", desc: "Get a published post by slug" },
      { method: "GET", path: "/api/v1/posts/mine", auth: "JWT / API Key (posts:read)", desc: "List your posts (drafts + published)" },
      { method: "PUT", path: "/api/v1/posts/:id", auth: "JWT / API Key (posts:write)", desc: "Update a post" },
      { method: "DELETE", path: "/api/v1/posts/:id", auth: "JWT / API Key (posts:write)", desc: "Archive a post" },
    ],
  },
  {
    section: "Feed",
    endpoints: [
      { method: "GET", path: "/api/v1/feed/latest", auth: "None", desc: "Latest published posts" },
      { method: "GET", path: "/api/v1/feed/trending", auth: "None", desc: "Trending posts by engagement" },
    ],
  },
  {
    section: "Users",
    endpoints: [
      { method: "GET", path: "/api/v1/users/:username", auth: "None", desc: "Get user profile" },
      { method: "GET", path: "/api/v1/users/:username/posts", auth: "None", desc: "List user's published posts" },
    ],
  },
  {
    section: "API Keys",
    endpoints: [
      { method: "POST", path: "/api/v1/api-keys", auth: "JWT only", desc: "Create a new API key" },
      { method: "GET", path: "/api/v1/api-keys", auth: "JWT only", desc: "List your API keys" },
      { method: "DELETE", path: "/api/v1/api-keys/:id", auth: "JWT only", desc: "Revoke an API key" },
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

export default function APIDocsPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="container mx-auto px-4 py-10 max-w-[780px] flex-1">
        <h1 className="text-3xl font-bold mb-2">API Documentation</h1>
        <p className="text-muted-foreground mb-10">
          IndieStack is API-first. Use JWT tokens or API keys to access all features programmatically.
        </p>

        {/* Authentication */}
        <section className="mb-12">
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
        <section className="mb-12">
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
          <section key={section.section} className="mb-12">
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
        <section className="mb-12">
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
        <section className="mb-12">
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
      </main>
    </div>
  );
}
