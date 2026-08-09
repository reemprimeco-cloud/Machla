import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { cookies } from "next/headers";

import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { branding } from "@/lib/branding";
import { DEFAULT_LOCALE, directionFor, isSupportedLocale } from "@/lib/i18n/config";
import { LOCALE_COOKIE_NAME } from "@/lib/i18n/cookie";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

import "./globals.css";

// Modern webfont for Latin-script text (English, Filipino, Indonesian).
// Self-hosted at build time via next/font — no runtime request, no
// layout shift. Arabic, Urdu, Hindi/Nepali (Devanagari), Telugu, and
// Sinhala glyphs aren't in Geist's Latin subset, so those scripts
// transparently fall through to the platform-native font stack in
// globals.css, which already renders them well on every target OS —
// deliberately not self-hosting a Noto Sans variant per script for that,
// see docs/architecture/15-localization-architecture.md §5.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: branding.name,
  description: branding.description,
  applicationName: branding.name,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: branding.shortName,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: branding.themeColor,
};

// Reads the Phase 2 locale cookie (docs/architecture/15-localization-architecture.md)
// server-side so the very first response already has the correct
// <html lang dir> — no LTR-then-RTL flash, and no hydration mismatch,
// since LocaleProvider hydrates from this same value on the client.
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const cookieStore = await cookies();
  const rawLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const initialLocale = rawLocale && isSupportedLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;

  return (
    <html
      lang={initialLocale}
      dir={directionFor(initialLocale)}
      className={`${geistSans.variable} h-full`}
    >
      <body className="flex h-full min-h-screen flex-col bg-white font-sans text-neutral-900 antialiased">
        <LocaleProvider initialLocale={initialLocale}>
          {children}
          <ServiceWorkerRegistration />
        </LocaleProvider>
      </body>
    </html>
  );
}
