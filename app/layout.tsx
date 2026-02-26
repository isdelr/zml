import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "./ThemeProvider";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import { NotificationProvider } from "@/components/providers/NotificationProvider";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { RoutePrefetcher } from "@/components/RoutePrefetcher";
import { AuthSessionRefresher } from "@/components/providers/AuthSessionRefresher";
import { NonBlockingErrorBoundary } from "@/components/NonBlockingErrorBoundary";
import { ConvexConnectionGuard } from "@/components/ConvexConnectionGuard";

const ConvexClientProvider = dynamic(
  () => import("@/components/ConvexClientProvider"),
);
const Toaster = dynamic(() =>
  import("@/components/ui/sonner").then((mod) => mod.Toaster),
);
const MusicPlayer = dynamic(() =>
  import("@/components/MusicPlayer").then((mod) => ({
    default: mod.MusicPlayer,
  })),
);
const BottomNavbar = dynamic(() =>
  import("@/components/BottomNavbar").then((mod) => ({
    default: mod.BottomNavbar,
  })),
);

const geistSans = localFont({
  src: "./fonts/geist/GeistSans-Variable.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/geist/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
  adjustFontFallback: false,
  fallback: [
    "ui-monospace",
    "SFMono-Regular",
    "Roboto Mono",
    "Menlo",
    "Monaco",
    "Liberation Mono",
    "DejaVu Sans Mono",
    "Courier New",
    "monospace",
  ],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://zml.app"),
  title: {
    template: "ZML | %s",
    default: "ZML",
  },
  description:
    "The ultimate platform to challenge your friends' musical tastes. Create leagues, set themed rounds, and vote for the best tracks.",
  icons: {
    icon: "/icons/favicon.ico",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ZML",
  },
  openGraph: {
    title: "ZML - Challenge Your Friends' Musical Tastes",
    description:
      "The ultimate platform to challenge your friends' musical tastes. Create leagues, set themed rounds, and vote for the best tracks.",
    url: "https://zml.app",
    siteName: "ZML",
    type: "website",
    images: [
      {
        url: "/api/og/default",
        width: 1200,
        height: 630,
        alt: "ZML - Challenge your friends' musical tastes",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ZML - Challenge Your Friends' Musical Tastes",
    description:
      "The ultimate platform to challenge your friends' musical tastes. Create leagues, set themed rounds, and vote for the best tracks.",
    images: ["/api/og/default"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F0ED" },
    { media: "(prefers-color-scheme: dark)", color: "#201E1C" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          geistSans.variable,
          geistMono.variable,
          "antialiased overflow-x-hidden",
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {/* Register SW for all users (prod), manage skipWaiting and updates */}
          <NonBlockingErrorBoundary boundaryName="ServiceWorkerRegistrar">
            <ServiceWorkerRegistrar />
          </NonBlockingErrorBoundary>

          <ConvexClientProvider>
            {/* Keep the auth cookie/session warm in PWAs and refresh on focus */}
            <NonBlockingErrorBoundary boundaryName="AuthSessionRefresher">
              <AuthSessionRefresher />
            </NonBlockingErrorBoundary>

            {/* Prefetch key routes early for snappier nav */}
            <RoutePrefetcher />

            <NotificationProvider>
              <ConvexConnectionGuard>
                <main className="min-h-dvh pb-[calc(env(safe-area-inset-bottom)+4.5rem)] md:pb-0">
                  {children}
                </main>
              </ConvexConnectionGuard>
              <Toaster />
              <NonBlockingErrorBoundary boundaryName="MusicPlayer">
                <MusicPlayer />
              </NonBlockingErrorBoundary>
              <BottomNavbar />
            </NotificationProvider>
          </ConvexClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
