import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Sparkles } from "lucide-react";
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
  title: {
    default: "BrainCoder — Free dev tools for everyone",
    template: "%s · BrainCoder",
  },
  description:
    "A free, private collection of developer tools — compress PDFs & images, encode, convert, format and more. All in your browser, no uploads.",
};

export default function RootLayout(props: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg text-slate-900">
                Brain<span className="text-indigo-600">Coder</span>
              </span>
            </Link>
            <nav className="flex items-center gap-2 text-sm">
              <Link href="/#tools" className="px-3 py-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition">
                Tools
              </Link>
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
              <div className="w-6 h-6 rounded bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-white" />
              </div>
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