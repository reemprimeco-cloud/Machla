import type { Metadata, Viewport } from "next";
import {
  IBM_Plex_Sans_Arabic,
  Noto_Nastaliq_Urdu,
  Noto_Sans_Devanagari,
  Noto_Sans_Sinhala,
  Noto_Sans_Telugu,
  Poppins,
  Noto_Sans,
  Noto_Sans_Ethiopic,
} from "next/font/google";
import { cookies } from "next/headers";

import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { ConnectionBanner } from "@/components/ui/ConnectionBanner";
import { getServerUserProfile } from "@/lib/auth/session";
import { branding } from "@/lib/branding";
import { DEFAULT_LOCALE, directionFor, isSupportedLocale, scriptFor } from "@/lib/i18n/config";
import { LOCALE_COOKIE_NAME } from "@/lib/i18n/cookie";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

import "./globals.css";

// Multi-script type system (docs/design/BRAND.md, docs/architecture/15-localization-architecture.md §9).
// Self-hosted at build time via next/font — no runtime CDN request for
// any of the 9 languages. Poppins + IBM Plex Sans Arabic are "tier 1":
// the UI chrome, always needed, so they preload. The other four are
// "tier 2": preload disabled, so the browser only fetches that font's
// bytes once text actually needs it (e.g. the language picker showing a
// Devanagari row, or the user switching to Urdu) — not on every load.
// Each `variable` name below is deliberately suffixed "-nf" (next/font) —
// distinct from the --font-latin/--font-arabic/... names globals.css
// defines for actual use. A CSS custom property that references itself
// (even via cascade with an identically-named variable from another
// stylesheet) resolves as invalid, so the two layers must not share a
// name — globals.css's :root block reads these -nf variables with a
// literal-family fallback, and everything else in the app reads the
// public --font-* names, never these directly.
const poppins = Poppins({
  variable: "--font-latin-nf",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic-nf",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const notoNastaliqUrdu = Noto_Nastaliq_Urdu({
  variable: "--font-nastaliq-nf",
  subsets: ["arabic"],
  weight: ["400", "700"],
  display: "swap",
  preload: false,
});

const notoSansDevanagari = Noto_Sans_Devanagari({
  variable: "--font-devanagari-nf",
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
});

const notoSansTelugu = Noto_Sans_Telugu({
  variable: "--font-telugu-nf",
  subsets: ["telugu"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
});

const notoSansSinhala = Noto_Sans_Sinhala({
  variable: "--font-sinhala-nf",
  subsets: ["sinhala"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
});

// Fon (Fɔngbè) uses ɖ ɛ ɔ ŋ and combining tone marks that Poppins does not
// contain — left on "latin" alone it renders tofu, or worse, silently
// falls back mid-word and breaks the line. The subsets order matters here:
// "latin-ext" is requested so this instance actually carries the glyphs
// Poppins is missing, rather than duplicating what Poppins already covers.
const notoSansLatinExt = Noto_Sans({
  variable: "--font-latin-ext-nf",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
});

const notoSansEthiopic = Noto_Sans_Ethiopic({
  variable: "--font-ethiopic-nf",
  subsets: ["ethiopic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
});

const FONT_VARIABLES = [
  poppins.variable,
  ibmPlexSansArabic.variable,
  notoNastaliqUrdu.variable,
  notoSansDevanagari.variable,
  notoSansTelugu.variable,
  notoSansSinhala.variable,
  notoSansEthiopic.variable,
  notoSansLatinExt.variable,
].join(" ");

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
// <html lang dir data-script> — no LTR-then-RTL flash, no wrong-font
// flash, and no hydration mismatch, since LocaleProvider hydrates from
// this same value on the client.
//
// Phase 3: if the visitor is signed in and has a stored
// `users.preferred_language`, it wins over the device cookie — this is
// the reconciliation for a fresh login on a device whose cookie doesn't
// match the account's saved preference yet. Doing this here (server-
// side, before the first render) rather than as a client-side effect
// keeps LocaleProvider a plain "sync state to the DOM" component, and
// means there's no flash while a client effect catches up.
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const cookieStore = await cookies();
  const rawLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const cookieLocale = rawLocale && isSupportedLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;

  const profile = await getServerUserProfile();
  const preferredLocale = profile?.preferred_language;
  const initialLocale =
    preferredLocale && isSupportedLocale(preferredLocale) ? preferredLocale : cookieLocale;

  return (
    <html
      lang={initialLocale}
      dir={directionFor(initialLocale)}
      data-script={scriptFor(initialLocale)}
      className={`${FONT_VARIABLES} h-full`}
    >
      <body className="flex h-full min-h-screen flex-col antialiased">
        <LocaleProvider initialLocale={initialLocale}>
          {children}
          <ConnectionBanner />
          <ServiceWorkerRegistration />
        </LocaleProvider>
      </body>
    </html>
  );
}
