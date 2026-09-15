import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { LogoMark } from "@/components/Logo";
import { CATEGORIES, getCategorySlug } from "@/lib/tools";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo";
import { Analytics } from "@/components/Analytics";
import { PwaRegister } from "@/components/PwaRegister";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BrainCoder",
  },
  title: {
    default: `${SITE_NAME} — Free dev tools for everyone`,
    template: "%s · BrainCoder",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "online tools",
    "developer tools",
    "dev utilities",
    "free online toolbox",
    "file converter",
    "code formatter",
    "hash generator",
    "json formatter",
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
    title: `${SITE_NAME} — Free dev tools for everyone`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout(props: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <Analytics />
        <PwaRegister />
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <SiteHeader />

        <main id="main" className="flex-1 flex flex-col">{props.children}</main>

        <footer className="bg-slate-900 text-white/60 py-10">
          <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <LogoMark className="w-6 h-6" />
              <span className="font-semibold text-white">BrainCoder</span>
            </div>
            <p className="text-xs">
              © {new Date().getFullYear()} BrainCoder · Free forever · Files stay on your device
            </p>
          </div>
          <div className="max-w-6xl mx-auto px-5 mt-6 pt-6 border-t border-white/10">
            <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs" aria-label="Footer tools">
              {CATEGORIES.map((c) => (
                <a
                  key={c}
                  href={`/categories/${getCategorySlug(c)}`}
                  className="hover:text-white transition"
                  title={`${c} tools`}
                >
                  {c}
                </a>
              ))}
            </nav>
            <nav className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs" aria-label="Footer links">
              <a href="/verify" className="hover:text-white transition">
                Verify: 0 uploads
              </a>
              <Link href="/guides" className="hover:text-white transition">
                Guides
              </Link>
              <a
                href="https://github.com/RajaSardar/BrainCoder"
                target="_blank"
                rel="noreferrer"
                className="hover:text-white transition"
              >
                GitHub
              </a>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}