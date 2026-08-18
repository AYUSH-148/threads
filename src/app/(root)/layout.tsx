import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { Suspense } from "react";
import { ClerkProvider } from "@clerk/nextjs";

import "@/app/globals.css";

import AuroraBackground from "@/components/AuroraBackground";
import BottomBar from "@/components/BottomBar";
import LeftSidebar from "@/components/LeftSidebar";
import RightSidebar from "@/components/RightSidebar";
import RouteProgressBar from "@/components/RouteProgress";
import Topbar from "@/components/Topbar";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { clerkAppearance } from "@/lib/clerkAppearance";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// A second, more characterful face for headings and controls. Body copy stays
// on Inter, which is the better read at 14–16px.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Relay",
    template: "%s · Relay",
  },
  description: "A social platform for threaded conversations and communities.",
};

export const viewport: Viewport = {
  // Drives the browser chrome colour on mobile, so the address bar matches the
  // canvas in whichever theme is live.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBFAFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0A12" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider appearance={clerkAppearance}>
      <html
        lang="en"
        className={`${inter.variable} ${jakarta.variable}`}
        suppressHydrationWarning
      >
        <head>
          {/* Themes the document before the first paint. See lib/theme.ts for
              why this cannot be a normal component or a deferred script. */}
          <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        </head>
        <body className="font-sans antialiased">
          <ThemeProvider>
            <AuroraBackground />

            <Topbar />

            {/* useSearchParams opts the subtree into client-side rendering;
                the boundary keeps that from bubbling up to the whole layout. */}
            <Suspense fallback={null}>
              <RouteProgressBar />
            </Suspense>

            <main className="flex flex-row">
              <LeftSidebar />

              <section className="main-container">
                <div className="w-full max-w-2xl">{children}</div>
              </section>

              <RightSidebar />
            </main>

            <BottomBar />

            {/* Never mounted before, so every toast() call in the app was a
                no-op — share, delete and form errors all failed silently. */}
            <Toaster />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
