import path from "node:path";
import { fileURLToPath } from "node:url";
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js injecte des scripts/styles inline ; Mapbox utilise blob: et workers.
      "script-src 'self' 'unsafe-inline' blob: https://api.mapbox.com",
      "style-src 'self' 'unsafe-inline' https://api.mapbox.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' blob: https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com",
      "worker-src 'self' blob:",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=(self), payment=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
]

const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: workspaceRoot,
  turbopack: { root: workspaceRoot },
  typescript: { ignoreBuildErrors: false },
  images: { unoptimized: true },
  async rewrites() {
    if (process.env.NODE_ENV === "production") return [];
    return [{ source: "/backend/:path*", destination: `${process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000"}/:path*` }];
  },
  async headers() { return [{ source: "/:path*", headers: securityHeaders }, { source: "/sw.js", headers: [{key:"Cache-Control",value:"no-store"}] }]; }
};
export default nextConfig;
