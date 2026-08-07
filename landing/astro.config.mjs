import { defineConfig } from "astro/config";

// Static output, served from /_astro for assets. The site is a single static
// landing page served at the root path (Caddy routes "/" to this service).
export default defineConfig({
  output: "static",
  build: {
    // Keep assets under /_astro (Astro's default) so Caddy can route them.
    assets: "_astro",
  },
});
