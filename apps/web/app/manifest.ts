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
    // A `maskable` icon is a SEPARATE asset, not the same file relabelled.
    // Android crops a maskable icon to its own shape — often a circle
    // covering the inner ~80% — so artwork that runs to the edges gets its
    // corners and baseline cut off. The icon-*.png files are full-bleed
    // rounded squares, so they are declared "any" only; maskable-*.png
    // carries the same mark at 60% on brand green, which survives any mask
    // the platform applies. Without a maskable icon at all, Android
    // letterboxes the "any" one into a white rounded square — which is the
    // first thing a worker sees on their home screen.
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
