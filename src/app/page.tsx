import type { Metadata } from "next";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, siteJsonLd } from "@/lib/seo";
import HomeContent from "@/components/HomeContent";

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} — Free dev tools for everyone`,
    absolute: `${SITE_NAME} — Free dev tools, all in your browser`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
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
    title: `${SITE_NAME} — Free dev tools, all in your browser`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
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
      <HomeContent />
    </>
  );
}