import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";
import { MainWrapper } from "@/components/main-wrapper";
import { AppRails } from "@/components/app-rails";

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
        <Providers>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
              <TopBar />
              <MainWrapper>{children}</MainWrapper>
            </div>
            <AppRails />
          </div>
        </Providers>
      </body>
    </html>
  );
}
