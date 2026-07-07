import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { getLocale, getTranslations } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";
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
  const t = await getTranslations();
  return {
    title: t.meta.title,
    description: t.meta.description,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

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
          >
            <I18nProvider locale={locale}>
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
            </I18nProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
