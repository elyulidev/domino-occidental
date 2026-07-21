import type { MetadataRoute } from "next";

const SITE_URL = "https://domino-occidental-frontend-liart.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/lobby",
          "/friends",
          "/notifications",
          "/pairs",
          "/shop",
          "/profile/",
          "/users/",
          "/tournaments/",
          "/match/",
          "/leaderboard",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
