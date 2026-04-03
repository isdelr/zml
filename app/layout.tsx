import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Suspense } from "react";
import "./globals.css";
import { ThemeProvider } from "./ThemeProvider";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import { NotificationProvider } from "@/components/providers/NotificationProvider";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { AuthSessionRefresher } from "@/components/providers/AuthSessionRefresher";
import { NonBlockingErrorBoundary } from "@/components/NonBlockingErrorBoundary";

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
const ObservabilityProvider = dynamic(() =>
  import("@/components/providers/ObservabilityProvider").then((mod) => ({
    default: mod.ObservabilityProvider,
  })),
);

const plusJakartaSans = localFont({
  src: [
    {
      path: "./fonts/plus-jakarta-sans/PlusJakartaSans-Variable.ttf",
      weight: "200 800",
      style: "normal",
    },
    {
      path: "./fonts/plus-jakarta-sans/PlusJakartaSans-Italic-Variable.ttf",
      weight: "200 800",
      style: "italic",
    },
  ],
  variable: "--font-plus-jakarta-sans",
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
          plusJakartaSans.variable,
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
            <Suspense fallback={null}>
              <ObservabilityProvider />
            </Suspense>

            {/* Keep the auth cookie/session warm in PWAs and refresh on focus */}
            <NonBlockingErrorBoundary boundaryName="AuthSessionRefresher">
              <AuthSessionRefresher />
            </NonBlockingErrorBoundary>

            <NotificationProvider>
              <main className="min-h-dvh pb-[env(safe-area-inset-bottom)] md:pb-0">
                {children}
              </main>
              <Toaster />
              <NonBlockingErrorBoundary boundaryName="MusicPlayer">
                <MusicPlayer />
              </NonBlockingErrorBoundary>
            </NotificationProvider>
          </ConvexClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
