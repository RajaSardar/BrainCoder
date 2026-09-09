import Script from "next/script";

/**
 * Lightweight, privacy-friendly analytics.
 *
 * Set NEXT_PUBLIC_ANALYTICS_DOMAIN (e.g. "braincoder.example.com") to enable.
 * Works with Plausible (including the free Vercel integration) — cookieless
 * and GDPR-friendly, which matches the site's "nothing leaves your device" brand.
 * Omit the env var to disable entirely.
 */
export function Analytics() {
  const domain = process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN;
  if (!domain) return null;
  return (
    <Script
      defer
      data-domain={domain}
      src="https://plausible.io/js/script.js"
      strategy="afterInteractive"
    />
  );
}