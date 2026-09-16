import type { NextConfig } from "next";

/**
 * Content Security Policy.
 *
 * BrainsCoder is a fully client-side toolkit — all heavy lifting (WASM, canvas,
 * PDF rendering, OCR) runs in the browser. The CSP is intentionally strict
 * except for the few capabilities the tools genuinely need:
 *
 *   - 'unsafe-inline' : Next.js injects inline <style> and <script> tags for
 *     hydration and server components.
 *   - blob:           WASM workers (pdf.js, tesseract.js) and canvas snapshot
 *                     helpers create blob URLs.
 *   - data:           Tools that embed user-supplied images/files use data: URIs.
 *   - https://va.vercel-scripts.com : Vercel Core Web Analytics (cookieless, no tracking).
 *
 * Everything else is denied by default-src 'self'.
 */
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "worker-src 'self' blob:",
  "connect-src 'self' blob: data: https://va.vercel-scripts.com https://vitals.vercel-analytics.com",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: CSP_DIRECTIVES,
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
