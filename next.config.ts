// next.config.ts
import type { NextConfig } from "next";

/**
 * @type {import('next').NextConfig}
 */
const nextConfig: NextConfig = {
  images: {
    // Recommendation 1: Set a long cache TTL.
    // For images that do not change often, like album art or league art,
    // this setting tells the browser and Vercel's Edge to cache the optimized
    // image for a longer period (31 days). This dramatically reduces the
    // number of times an image needs to be re-optimized.
    minimumCacheTTL: 2678400,

    // Recommendation 2: Reduce the number of generated image formats.
    // By default, Next.js creates both AVIF and WebP versions for images.
    // Specifying only 'image/webp' halves the number of transformations
    // for each image source, significantly cutting down on usage.
    formats: ["image/webp"],

    // Recommendation 3: Use specific remotePatterns instead of general domains.
    // This is the modern, more secure way to allowlist external image sources.
    // It prevents your optimization service from being used on unintended images.
    remotePatterns: [
      {
        protocol: "https",
        hostname:
          "zml.3bc51bd99a44e5fd20632a75f91d6366.r2.cloudflarestorage.com",
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
        hostname: "i.scdn.co",
        port: "",
        pathname: "/image/**",
      },
    ],

    // Recommendation 4: Tailor device and image sizes to your app's design.
    // The default Next.js sizes are very broad. By providing a smaller,
    // custom set of sizes that match your UI (small avatars, cards, etc.),
    // you prevent the creation of many unnecessary image variants.
    deviceSizes: [320, 420, 640, 750, 828], // Tailored for mobile and small desktop views
    imageSizes: [48, 64, 96, 128, 256], // Covers avatar and card sizes used in your app

    qualities: [70],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
