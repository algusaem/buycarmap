import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { TimeZoneCookie } from "@/lib/geo/TimeZoneCookie";
import { MotionProvider } from "@/components/MotionProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { TabBar } from "@/components/nav/TabBar";
import { SiteHeader } from "@/components/nav/SiteHeader";
import { SkipLink } from "@/components/nav/SkipLink";
import { Toaster } from "@/components/Toaster";
import "./globals.css";

// Each family carries the fallback stack of docs/design/system/tokens.json in
// case the file fails to load.
const rethinkSans = localFont({
  src: "./fonts/rethink-sans/rethink-sans-latin-wght-normal.woff2",
  variable: "--font-sans",
  weight: "400 800",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

const unbounded = localFont({
  src: "./fonts/unbounded/unbounded-latin-wght-normal.woff2",
  variable: "--font-display",
  weight: "200 900",
  display: "swap",
  fallback: ["Arial Black", "system-ui", "sans-serif"],
});

// The app has a single dark theme (LOOK-3, docs/specs/redesign-foundation.md).
export const viewport: Viewport = {
  themeColor: "#0F0F10",
  colorScheme: "dark",
  // HEAD-17 (docs/specs/redesign-navigation.md): the page reaches under the
  // phone's home indicator, so env(safe-area-inset-bottom) is non-zero and
  // the bottom nav can clear it.
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);

  return (
    <html lang={locale} className={`dark ${rethinkSans.variable} ${unbounded.variable}`}>
      <body className="flex h-viewport flex-col overflow-hidden font-sans antialiased">
        {/* The first thing in the document, before the header (A11Y-1). */}
        <SkipLink />
        <AuthProvider>
          <MotionProvider>
            <NextIntlClientProvider locale={locale} messages={messages}>
              <NuqsAdapter>
                <TimeZoneCookie />
                <SiteHeader />
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
                <TabBar />
                <Toaster />
              </NuqsAdapter>
            </NextIntlClientProvider>
          </MotionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
