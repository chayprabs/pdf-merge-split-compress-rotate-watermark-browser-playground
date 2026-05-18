import type { NextConfig } from "next";

/** Security headers for static hosting are in [public/_headers](public/_headers) (e.g. Cloudflare Pages). `output: export` does not apply `headers()` from Next config. */

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
