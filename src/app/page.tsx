import type { Metadata } from "next";
import {
  SITE_URL,
  SITE_NAME,
  SITE_DESCRIPTION,
  siteJsonLd,
  homeFaqJsonLd,
} from "@/lib/seo";
import { HomeHero } from "@/components/HomeHero";
import { HomeFeatured } from "@/components/HomeFeatured";
import { ToolsExplorer } from "@/components/ToolsExplorer";
import { RecentTools } from "@/components/RecentTools";
import { CategoryIndex } from "@/components/CategoryIndex";
import { HomeFaq } from "@/components/HomeFaq";

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} — Free online developer tools and utilities`,
    absolute: `${SITE_NAME} — Privacy-first tools for developers`,
  },
  description:
    "Developer utilities that run entirely in your browser — JSON formatter, base64, PDF tools, regex tester, hash generator and more. No uploads, no sign-up, no limits.",
  keywords: [
    "json formatter",
    "base64 encoder",
    "regex tester",
    "hash generator",
    "pdf compressor no upload",
    "privacy first developer tools",
    "client side tools",
    "browser based utilities",
    "developer toolbox",
    "no sign up tools",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: `${SITE_NAME} — Free dev tools for everyone`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Free dev tools, all in your browser`,
    description: SITE_DESCRIPTION,
  },
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeFaqJsonLd()) }}
      />
      <HomeHero />
      <div className="h-8" />
      <RecentTools />
      <div className="h-8" />
      <HomeFeatured />
      <ToolsExplorer />
      <CategoryIndex />
      <HomeFaq />
    </>
  );
}