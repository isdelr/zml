 
import type { NextConfig } from "next";

/**
 * @type {import('next').NextConfig}
 */
const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    minimumCacheTTL: 2678400,
    formats: ["image/webp"],
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

     
     
     
     
    deviceSizes: [320, 420, 640, 750, 828],  
    imageSizes: [48, 64, 96, 128, 256],  

    qualities: [70],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
