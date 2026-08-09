import type { Metadata, Viewport } from "next";

import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { branding } from "@/lib/branding";

import "./globals.css";

export const metadata: Metadata = {
  title: `${branding.name} — ${branding.tagline}`,
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

// Phase 1 ships a static shell: lang="en" / dir="ltr". Phase 2 makes both
// dynamic from the signed-in user's preferred_language (or the pre-auth
// language cookie), per docs/architecture/06-auth-otp-flow.md and
// master-plan Phase 2 (RTL support for Arabic and Urdu).
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" dir="ltr" className="h-full">
      <body className="flex h-full min-h-screen flex-col bg-white text-neutral-900 antialiased">
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
