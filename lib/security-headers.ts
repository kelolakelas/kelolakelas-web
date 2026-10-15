/**
 * App-owned baseline security headers (KEL-187).
 *
 * Ownership: the Next.js app itself emits these headers through `headers()`
 * in `next.config.ts` (`source: '/:path*'`), so every app response — normal
 * pages, API-less routes, and error responses such as the branded 404 — carries
 * the same baseline. The edge/CDN layer MUST NOT add, strip, or override them:
 * adding the same header at the edge would produce duplicate response headers
 * (config headers are always emitted), while stripping would silently drop the
 * baseline. `proxy.ts` stays auth/routing-only on purpose — its matcher skips
 * `_next/static`, `_next/image`, `api/`, and public assets, so headers set
 * there would miss exactly those paths.
 *
 * How to verify without any edge in front (AC2):
 *   1. `npm run build`, then start the app directly (`npm run start`).
 *   2. `curl -sI http://localhost:<port>/` (real 200) and
 *      `curl -sI http://localhost:<port>/tidak-ada-seperti-ini` (real 404).
 *   3. Both responses must carry `X-Content-Type-Options: nosniff`,
 *      `Referrer-Policy: strict-origin-when-cross-origin`,
 *      `X-Frame-Options: DENY`, and `Content-Security-Policy-Report-Only`.
 *
 * Report-only CSP inventory (AC3) — sources the web app really uses:
 * - scripts: framework runtime/hydration inline scripts emitted by Next.js and
 *   React, one inline JSON-LD block on the landing page
 *   (`app/(public)/page.tsx`), and Server Action inline handlers. `script-src
 *   'self'` therefore *reports* (never blocks — report-only) on those inline
 *   scripts; that noise is expected and is the inventory signal for the future
 *   enforcement iteration.
 * - styles: Tailwind-generated inline `<style>` blocks — same report-only note
 *   as scripts.
 * - images: `img-src 'self' data:` because QRIS codes are rendered from
 *   `data:` URLs (`lib/pay-qr.ts` → `<img src={qrImage}>`).
 * - fonts: `next/font/google` (Geist) is self-hosted by the build, so
 *   `font-src 'self'` covers it with no external font host.
 * - network from the browser: only the chat WebSocket
 *   (`NEXT_PUBLIC_CHAT_WS_URL`, `lib/chat.ts`). The gateway is called
 *   server-side only, never from the browser. `connect-src 'self'` therefore
 *   reports the chat socket when its origin differs from the web origin —
 *   expected inventory noise, not a breakage.
 * - payment: hosted checkout is a top-level navigation through an anchor
 *   (`target="_blank"`, `checkout_session_url` / provider `app_url`), never a
 *   fetch, form POST to the provider, or iframe — so no provider host needs an
 *   allowlist entry, and `form-action 'self'` stays safe (every form is a
 *   Server Action posting back to the app). No `<iframe>` exists anywhere, so
 *   `frame-src 'none'` together with `X-Frame-Options: DENY` denies framing.
 *
 * Deliberately out of scope: CSP enforcement, HSTS, edge provisioning, and any
 * external CSP reporting endpoint.
 */

export const BASELINE_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
] as const;

export const REPORT_ONLY_CSP_HEADER_NAME = 'Content-Security-Policy-Report-Only';

/**
 * Report-only CSP value. Single line (no folding): newlines inside a header
 * value would be rejected or mangled by servers and intermediaries.
 */
export function buildReportOnlyCsp(): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/** Full app-owned header list wired into `next.config.ts` `headers()`. */
export function appSecurityHeaders(): Array<{ key: string; value: string }> {
  return [
    ...BASELINE_HEADERS.map(({ key, value }) => ({ key, value })),
    { key: REPORT_ONLY_CSP_HEADER_NAME, value: buildReportOnlyCsp() },
  ];
}
