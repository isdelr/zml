import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    scope: "/",
    name: "ZML - The Ultimate Music League",
    short_name: "ZML",
    description:
      "The ultimate platform to challenge your friends' musical tastes. Create leagues, set themed rounds, and vote for the best tracks.",
    start_url: "/?source=pwa",
    display: "standalone",
    display_override: ["standalone", "browser"],
    background_color: "#201E1C",
    theme_color: "#E88A1A",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/favicon.ico",
        sizes: "48x48",
        type: "image/x-icon",
      },
    ],
    shortcuts: [
      { name: "Explore", url: "/explore", description: "Explore public leagues" },
      { name: "Active Rounds", url: "/active-rounds", description: "Rounds you can play or vote" },
      { name: "Submissions", url: "/my-submissions", description: "Your past submissions" },
      { name: "Bookmarked", url: "/bookmarked", description: "Saved songs" },
    ],
    screenshots: [],
    categories: ["music", "social", "entertainment"],
  };
}
