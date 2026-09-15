import Link from "next/link";
import { Code2, Fingerprint, Globe, Lock, MonitorCheck, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { NetworkAudit } from "@/components/NetworkAudit";
import { LocalHashDemo } from "@/components/LocalHashDemo";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Verify: 0 uploads — proof your files never leave your device",
  description:
    "Watch a live network audit prove that BrainCoder tools process files 100% in your browser. Drop a file, hash it locally — zero bytes sent.",
  keywords: [
    "no upload proof",
    "client side tools",
    "files never leave your device",
    "privacy proof",
    "in browser processing",
    "no server tools",
  ],
  alternates: {
    canonical: "/verify",
  },
  openGraph: {
    title: "Verify: 0 uploads — watch it live",
    description:
      "A live network audit runs on this page. Drop a file and watch it be processed with zero bytes leaving your device.",
    url: `${SITE_URL}/verify`,
    siteName: SITE_NAME,
    type: "website",
    locale: "en_US",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function VerifyPage() {
  return (
    <div className="max-w-6xl mx-auto px-5 pt-6 w-full pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebPage",
                name: "Verify: 0 uploads — BrainCoder privacy proof",
                url: `${SITE_URL}/verify`,
                description: SITE_DESCRIPTION,
                isPartOf: {
                  "@type": "WebSite",
                  name: SITE_NAME,
                  url: SITE_URL,
                },
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  {
                    "@type": "ListItem",
                    position: 1,
                    name: "Home",
                    item: SITE_URL,
                  },
                  {
                    "@type": "ListItem",
                    position: 2,
                    name: "Verify: 0 uploads",
                    item: `${SITE_URL}/verify`,
                  },
                ],
              },
            ],
          }),
        }}
      />

      {/* Hero */}
      <div className="relative rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 mb-10 shadow-sm overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500"
        />
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-full px-3 py-1">
            <ShieldCheck className="w-3 h-3" />
            Proof, not a promise
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
          Verify: 0 uploads
        </h1>
        <p className="mt-3 text-lg text-slate-600 max-w-2xl">
          Every BrainCoder tool runs 100% in your browser. This page proves it
          — with a live network audit you can watch, and a demo file you can
          hash without a single byte leaving your device.
        </p>
        <p className="mt-4 text-xs text-slate-500 flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5" />
          The audit below intercepts <code>fetch</code> and{" "}
          <code>XMLHttpRequest</code>. If a tool ever tried to upload your
          file, it would be caught and shown here in red.
        </p>
      </div>

      {/* Live audit + demo */}
      <div className="grid lg:grid-cols-2 gap-6 mb-14">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 mb-3">
            Live network audit
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            This panel hooks the browser&apos;s network APIs the moment the page
            loads and logs anything that tries to send data anywhere.
          </p>
          <NetworkAudit />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 mb-3">
            Try it — hash a file right now
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Pick any file and watch the audit stay at zero while its SHA-256
            fingerprint is computed locally with the Web Crypto API.
          </p>
          <LocalHashDemo />
        </div>
      </div>

      {/* How it works */}
      <div className="mb-14">
        <h2 className="text-xl font-extrabold text-slate-900 mb-2">
          How can tools run without a server?
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          Modern browsers are powerful enough to do the heavy lifting on
          device — so we do.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: <Globe className="w-5 h-5 text-indigo-600" />,
              title: "Static delivery",
              text: "The site is a static Next.js build served from a CDN. Your browser downloads code, not a processing service.",
            },
            {
              icon: <MonitorCheck className="w-5 h-5 text-indigo-600" />,
              title: "Client-side engines",
              text: "PDFs are handled by pdf.js / pdf-lib, images by canvas + WASM, text by JS — all bundled and run in your tab.",
            },
            {
              icon: <Fingerprint className="w-5 h-5 text-indigo-600" />,
              title: "Nothing to send",
              text: "Processing reads the file into memory, transforms it, and emits a download link via a Blob URL. No request exists to upload anything.",
            },
            {
              icon: <Code2 className="w-5 h-5 text-indigo-600" />,
              title: "Open source",
              text: "The entire codebase is public. You can read every tool's implementation and confirm nothing phones home.",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              {card.icon}
              <p className="mt-2 text-sm font-bold text-slate-900">
                {card.title}
              </p>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                {card.text}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Verify it yourself */}
      <div className="mb-14 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <h2 className="text-xl font-extrabold text-slate-900 mb-4">
          How to verify it yourself
        </h2>
        <ol className="space-y-4">
          {[
            "Open any tool on this site — say the PDF Compressor.",
            "Open your browser's Developer Tools (F12) — Network tab.",
            "Process a file, watch the request log.",
            "You'll see static assets load once… and never a request carrying your file. Because there isn't one to make.",
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-4">
              <span className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white text-sm font-bold shrink-0 shadow-md">
                {i + 1}
              </span>
              <p className="text-sm text-slate-600 leading-relaxed pt-1.5">
                {step}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-xs text-slate-400 leading-relaxed flex items-start gap-1.5">
          <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          The only traffic this site generates is loading its own static
          assets and your privacy-respecting, aggregate analytics beacon —
          neither ever contains file content.
        </p>
      </div>

      {/* CTA */}
      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 p-6 sm:p-8 text-center">
        <h2 className="text-xl font-extrabold text-slate-900 mb-2">
          Free forever — nothing to install, nothing to upload
        </h2>
        <p className="text-sm text-slate-600 max-w-xl mx-auto mb-5">
          Every language, format and file type has a tool here — and each one
          runs on your device just like the demo above.
        </p>
        <Link
          href="/#tools"
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-6 py-3 font-semibold text-sm hover:bg-emerald-700 transition shadow-lg shadow-emerald-500/25"
        >
          Browse all tools
        </Link>
      </div>
    </div>
  );
}