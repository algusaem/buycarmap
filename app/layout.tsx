import type { Metadata } from "next";
import { headers } from "next/headers";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { TimeZoneCookie } from "@/lib/geo/TimeZoneCookie";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { Navbar } from "@/components/Navbar";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
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
                <Toaster
                  position="top-center"
                  toastOptions={{
                    classNames: {
                      toast: "bg-card border-border text-foreground",
                    },
                  }}
                />
              </NuqsAdapter>
            </NextIntlClientProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
