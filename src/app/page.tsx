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
import { CategoryIndex } from "@/components/CategoryIndex";
import { HomeFaq } from "@/components/HomeFaq";

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} — Free online developer tools and utilities`,
    absolute: `${SITE_NAME} — 123 free online developer tools for your browser`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "free online tools",
    "online tools",
    "developer tools",
    "free online tools",
    "dev utilities",
    "json formatter",
    "base64 encoder",
    "pdf compressor",
    "hash generator",
    "regex tester",
    "code formatter",
    "file converter",
    "browser based tools",
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
      <HomeFeatured />
      <ToolsExplorer />
      <CategoryIndex />
      <HomeFaq />
    </>
  );
}