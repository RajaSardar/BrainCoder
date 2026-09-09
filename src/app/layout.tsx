import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo";
import { Analytics } from "@/components/Analytics";
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
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 group">
              <LogoMark className="w-8 h-8" />
              <span className="font-bold text-lg text-slate-900">
                Brain<span className="text-indigo-600">Coder</span>
              </span>
            </Link>
            <nav className="flex items-center gap-2 text-sm">
              <Link href="/#tools" className="px-3 py-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition">
                Tools
              </Link>
              <Link href="/guides" className="px-3 py-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition">
                Guides
              </Link>
              <a
                href="https://braincoder.vercel.app/"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
              >
                Live app
              </a>
              <a
                href="https://github.com/RajaSardar/BrainCoder"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
              >
                GitHub
              </a>
            </nav>
          </div>
        </header>

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