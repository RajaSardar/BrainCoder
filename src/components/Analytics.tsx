import { Analytics as VercelAnalytics } from "@vercel/analytics/next";

/**
 * Core Web Analytics from Vercel — cookieless, privacy-friendly, and
 * GDPR-compliant. Requires Web Analytics to be enabled for the project in the
 * Vercel dashboard. No config or env vars needed.
 */
export function Analytics() {
  return <VercelAnalytics />;
}