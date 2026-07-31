import { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:8080";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";

interface Post {
  slug: string;
  author_username: string;
  published_at: string;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE_URL}/feed`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE_URL}/discover`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${BASE_URL}/explore`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE_URL}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/pricing`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/jobs`, changeFrequency: "daily", priority: 0.6 },
  ];

  // Fetch published posts
  let postEntries: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${API_URL}/feed/latest?limit=500`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = await res.json();
      const posts: Post[] = data.data || [];
      postEntries = posts.map((post) => ({
        url: `${BASE_URL}/${post.author_username}/${post.slug}`,
        lastModified: post.published_at
          ? new Date(post.published_at)
          : undefined,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }));
    }
  } catch {
    // Silently fail — sitemap will still have static pages
  }

  // Fetch users for profile pages
  const userEntries: MetadataRoute.Sitemap = [];
  try {
    // We use the feed to discover authors
    const res = await fetch(`${API_URL}/feed/latest?limit=500`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = await res.json();
      const posts: Post[] = data.data || [];
      const seen = new Set<string>();
      for (const post of posts) {
        if (!seen.has(post.author_username)) {
          seen.add(post.author_username);
          userEntries.push({
            url: `${BASE_URL}/${post.author_username}`,
            changeFrequency: "daily" as const,
            priority: 0.6,
          });
        }
      }
    }
  } catch {
    // Silently fail
  }

  return [...staticPages, ...postEntries, ...userEntries];
}
