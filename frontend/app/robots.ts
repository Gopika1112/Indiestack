import { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:8080";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/settings", "/api/"],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
