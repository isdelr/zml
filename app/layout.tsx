import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ThemeProvider } from "./ThemeProvider";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import { NotificationProvider } from "@/components/providers/NotificationProvider";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { RoutePrefetcher } from "@/components/RoutePrefetcher";
import { AuthSessionRefresher } from "@/components/providers/AuthSessionRefresher";

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

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
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
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFBFF" },
    { media: "(prefers-color-scheme: dark)", color: "#1A1926" },
  ],
};

export default function RootLayout({
                                     children,
                                   }: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ConvexAuthNextjsServerProvider>
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
        <ServiceWorkerRegistrar />
        <ConvexClientProvider>
          {/* Keep the auth cookie/session warm in PWAs and refresh on focus */}
          <AuthSessionRefresher />

          {/* Prefetch key routes early for snappier nav */}
          <RoutePrefetcher />

          <NotificationProvider>
            <main className="min-h-dvh pb-[calc(env(safe-area-inset-bottom)+4.5rem)] md:pb-0">
              {children}
            </main>
            <Toaster />
            <MusicPlayer />
            <BottomNavbar />
          </NotificationProvider>
        </ConvexClientProvider>
      </ThemeProvider>
      </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}