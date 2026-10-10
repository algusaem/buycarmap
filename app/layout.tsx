import type { Metadata } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { TimeZoneCookie } from "@/lib/geo/TimeZoneCookie";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { Navbar } from "@/components/Navbar";
import { Toaster } from "@/components/Toaster";
import "./globals.css";

const plusJakarta = localFont({
  src: "./fonts/plus-jakarta-sans/plus-jakarta-sans-latin-wght-normal.woff2",
  variable: "--font-sans",
  weight: "300 800",
});

const jetbrainsMono = localFont({
  src: "./fonts/jetbrains-mono/jetbrains-mono-latin-wght-normal.woff2",
  variable: "--font-mono",
  weight: "400 500",
});

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
  // Passed to next-themes so its inline bootstrap script (which sets the
  // theme class before paint) carries the per-request nonce the CSP in
  // proxy.ts requires (PLAT-23, docs/specs/core-platform.md).
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${plusJakarta.variable} ${jetbrainsMono.variable} flex h-screen flex-col overflow-hidden font-sans antialiased`}
      >
        <AuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
            nonce={nonce}
          >
            <NextIntlClientProvider locale={locale} messages={messages}>
              <NuqsAdapter>
                <TimeZoneCookie />
                <Navbar />
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
                <Toaster />
              </NuqsAdapter>
            </NextIntlClientProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
