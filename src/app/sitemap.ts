import type { MetadataRoute } from "next";

const SITE_URL = "https://ranked-rps.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/rules", "/leaderboard", "/login", "/register"];

  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
  }));
}
