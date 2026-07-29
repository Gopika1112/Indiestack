import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://indiestack.local"),
  title: {
    default: "IndieStack - Share Your Stories",
    template: "%s | IndieStack",
  },
  description: "A high-performance content platform for independent writers and creators. Self-hosted, SEO-optimized, and built for scale.",
  keywords: ["blog", "newsletter", "writing", "content", "indie", "publishing"],
  authors: [{ name: "IndieStack" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://indiestack.local",
    siteName: "IndieStack",
  },
  twitter: {
    card: "summary_large_image",
    site: "@indiestack",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
