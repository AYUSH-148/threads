import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";

import "../globals.css";

import AuroraBackground from "@/components/AuroraBackground";
import BrandMark from "@/components/BrandMark";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import ThemeToggle from "@/components/theme/ThemeToggle";
import { clerkAppearance } from "@/lib/clerkAppearance";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sign in · Relay",
  description: "Sign in to Relay.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBFAFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0A12" },
  ],
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider appearance={clerkAppearance}>
      <html
        lang="en"
        className={`${inter.variable} ${jakarta.variable}`}
        suppressHydrationWarning
      >
        <head>
          <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        </head>
        <body className="font-sans antialiased">
          <ThemeProvider>
            <AuroraBackground />

            <div className="absolute right-4 top-4 z-10">
              <ThemeToggle />
            </div>

            <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
              <div className="animate-fade-up text-center">
                <div className="mb-5 flex items-center justify-center gap-3">
                  <BrandMark
                    size={40}
                    gradientId="relayAuthMark"
                    className="drop-shadow-[0_4px_14px_hsl(var(--brand)/0.5)]"
                  />
                  <span className="font-display text-heading2-bold tracking-tight text-fg">
                    Relay
                  </span>
                </div>
                <p className="mx-auto max-w-sm text-balance text-base-regular text-fg-muted">
                  Threaded conversations, passed along.
                </p>
              </div>

              <div
                className="animate-fade-up"
                style={{ animationDelay: "0.08s" }}
              >
                {children}
              </div>
            </main>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
