import type { MetadataRoute } from "next";

import { branding } from "@/lib/branding";

/**
 * PWA foundation (Phase 1 task). Production-grade multi-size PNG icons,
 * screenshots, and install-prompt polish are Phase 9 ("UX / Visual
 * Polish") work — this establishes that the app is installable at all.
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
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
