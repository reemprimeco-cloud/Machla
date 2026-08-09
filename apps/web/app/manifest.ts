import type { MetadataRoute } from "next";

import { branding } from "@/lib/branding";

/**
 * PWA foundation (Phase 1 task). Icons are the full ladder from the
 * HomeList UI Kit (docs/design/BRAND.md) — the favicon/apple-touch-icon
 * are wired separately via app/icon.svg and app/apple-icon.png (Next's
 * automatic favicon convention).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: branding.name,
    short_name: branding.shortName,
    description: branding.description,
    start_url: "/",
    display: "standalone",
    background_color: branding.backgroundColor,
    theme_color: branding.themeColor,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
