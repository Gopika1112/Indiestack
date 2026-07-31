/** @type {import("next").NextConfig} */
const nextConfig = {
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      // Local backend uploads (dev)
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "127.0.0.1" },
      // Internal service hostnames used inside docker-compose
      { protocol: "http", hostname: "go-api" },
      { protocol: "http", hostname: "caddy" },
      // User-supplied external image URLs
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};
module.exports = nextConfig;
