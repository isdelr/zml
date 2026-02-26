import type { NextConfig } from "next";
import createBundleAnalyzer from "@next/bundle-analyzer";
import { withSerwist } from "@serwist/turbopack";

const withBundleAnalyzer = createBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const storageEndpoint =
  process.env.B2_ENDPOINT ??
  process.env.R2_ENDPOINT ??
  "https://s3.us-west-004.backblazeb2.com";
const storageHostname = (() => {
  try {
    return new URL(storageEndpoint).hostname;
  } catch {
    return storageEndpoint.replace(/^https?:\/\//, "");
  }
})();
const distDir = process.env.NEXT_DIST_DIR;
const DEFAULT_PROXY_CLIENT_MAX_BODY_SIZE_BYTES =
  3 * 1024 * 1024 * 1024 + 16 * 1024 * 1024;
const configuredProxyClientMaxBodySize = Number.parseInt(
  process.env.NEXT_PROXY_CLIENT_MAX_BODY_SIZE_BYTES ??
    `${DEFAULT_PROXY_CLIENT_MAX_BODY_SIZE_BYTES}`,
  10,
);
const proxyClientMaxBodySize =
  Number.isFinite(configuredProxyClientMaxBodySize) &&
  configuredProxyClientMaxBodySize > 0
    ? configuredProxyClientMaxBodySize
    : DEFAULT_PROXY_CLIENT_MAX_BODY_SIZE_BYTES;

/**
 * @type {import('next').NextConfig}
 */
const nextConfig: NextConfig = {
  output: "standalone",
  ...(distDir ? { distDir } : {}),
  async headers() {
    return [
      {
        source: "/serwist/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
          {
            key: "Expires",
            value: "0",
          },
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/serwist/icons/:path*",
          destination: "/icons/:path*",
        },
        {
          source: "/serwist/offline.html",
          destination: "/offline.html",
        },
      ],
    };
  },
  experimental: {
    // Must exceed max multipart song upload size (3GB) plus multipart overhead.
    proxyClientMaxBodySize,
  },
  images: {
    minimumCacheTTL: 2678400,
    formats: ["image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: storageHostname,
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com",
        port: "",
        pathname: "/vi/**",
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
        port: "",
        pathname: "/vi/**",
      },
      {
        protocol: "https",
        hostname: "i.scdn.co",
        port: "",
        pathname: "/image/**",
      },
      {
        protocol: "https",
        hostname: "i.pravatar.cc",
        port: "",
        pathname: "/image/**",
      },
    ],

    deviceSizes: [320, 420, 640, 750, 828],
    imageSizes: [48, 64, 96, 128, 256],

    qualities: [70],
  },
};

export default withSerwist(withBundleAnalyzer(nextConfig));
