import type { MetadataRoute } from "next";

/**
 * Machla is a private application, not a website.
 *
 * Every meaningful screen is behind authentication, so a crawler can only
 * ever reach /welcome and /login — and indexing those puts a household
 * product's login page in search results for no benefit to anyone. The
 * disallow is a request, not a control; the actual protection is that
 * there is nothing readable without a session.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
