import type { MetadataRoute } from "next";

/**
 * Machla is a private application, not a website.
 *
 * Almost every screen is behind authentication, so a crawler can only
 * ever reach /welcome, /login, and /privacy — and indexing those puts a
 * household product's login page in search results for no benefit to
 * anyone. /privacy is public on purpose (it's the URL App Store Connect
 * needs a reviewer to open with no account), but "reachable by anyone
 * with the link" and "worth surfacing in search" are different things,
 * so it stays disallowed here too. The disallow is a request, not a
 * control; the actual protection for everything else is that there is
 * nothing readable without a session.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
