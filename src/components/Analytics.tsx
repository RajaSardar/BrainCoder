import { Analytics as VercelAnalytics } from '@vercel/analytics/next';

/**
 * Vercel Web Analytics integration.
 *
 * Provides privacy-friendly, lightweight analytics with seamless Next.js integration.
 * Automatically tracks page views and route changes without requiring manual configuration.
 * Analytics must be enabled in your Vercel project dashboard to collect data.
 */
export function Analytics() {
  return <VercelAnalytics />;
}