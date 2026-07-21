import type { MetadataRoute } from "next";

const SITE_URL = "https://domino-occidental-frontend-liart.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const publicRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/register`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];

  return publicRoutes;
}
