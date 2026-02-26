import { defineConfig, devices } from "@playwright/test";

const playwrightConvexUrl =
  process.env.PLAYWRIGHT_NEXT_PUBLIC_CONVEX_URL ?? "http://localhost:3210";
const playwrightConvexSiteUrl =
  process.env.PLAYWRIGHT_NEXT_PUBLIC_CONVEX_SITE_URL ?? "http://localhost:3211";
const playwrightAuthBaseUrl =
  process.env.PLAYWRIGHT_NEXT_PUBLIC_AUTH_BASE_URL ?? "http://127.0.0.1:3005";
const playwrightBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3005";
const usesExternalWebServer = Boolean(process.env.PLAYWRIGHT_BASE_URL);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: playwrightBaseUrl,
    trace: "on-first-retry",
  },
  webServer: usesExternalWebServer
    ? undefined
    : {
        command:
          `NEXT_DIST_DIR=.next-playwright NEXT_PUBLIC_CONVEX_URL=${playwrightConvexUrl} NEXT_PUBLIC_CONVEX_SITE_URL=${playwrightConvexSiteUrl} NEXT_PUBLIC_AUTH_BASE_URL=${playwrightAuthBaseUrl} next dev --hostname 127.0.0.1 --port 3005`,
        url: "http://127.0.0.1:3005",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
