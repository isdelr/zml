// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ThemeProvider } from "./ThemeProvider";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";

// Dynamically import components
const ConvexClientProvider = dynamic(() => import("@/components/ConvexClientProvider"));
const Toaster = dynamic(() => import("@/components/ui/sonner").then(mod => mod.Toaster));
const MusicPlayer = dynamic(() => import("@/components/MusicPlayer").then(mod => ({ default: mod.MusicPlayer })));
const BottomNavbar = dynamic(() => import("@/components/BottomNavbar").then(mod => ({ default: mod.BottomNavbar })));

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
    template: 'ZML | %s',
    default: 'ZML',
  },
  description: "The ultimate platform to challenge your friends' musical tastes. Create leagues, set themed rounds, and vote for the best tracks.",
  icons: {
    icon: "/favicon.svg",
  },
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
            "antialiased overflow-x-hidden pb-16 md:pb-0",
          )}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <ConvexClientProvider>
              {children}
              <Toaster />
              <MusicPlayer />
              <BottomNavbar />
            </ConvexClientProvider>
          </ThemeProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}