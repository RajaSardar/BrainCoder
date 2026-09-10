import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LogoMark } from "@/components/Logo";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo";
import { Analytics } from "@/components/Analytics";
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
    card: "summary",
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

export default function RootLayout(props: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <Analytics />
        <SiteHeader />

        <main className="flex-1 flex flex-col">{props.children}</main>

        <footer className="bg-slate-900 text-white/60 py-8">
          <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <LogoMark className="w-6 h-6" />
              <span className="font-semibold text-white">BrainCoder</span>
            </div>
            <p className="text-xs">
              © {new Date().getFullYear()} BrainCoder · Free forever · Files stay on your device
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}