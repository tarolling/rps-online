import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

const ROUTE_LAST_MODIFIED: Record<string, string> = {
  "": "2026-09-07",
  "/rules": "2026-09-07",
  "/leaderboard": "2026-09-07",
  "/login": "2026-09-07",
  "/register": "2026-09-07",
  "/play": "2026-09-07",
  "/clubs": "2026-09-07",
  "/tournaments": "2026-09-07",
  "/playAI": "2026-09-07",
  "/asyncGames": "2026-09-07",
  "/privacy": "2026-09-08",
  "/terms": "2026-09-08",
};

export default function sitemap(): MetadataRoute.Sitemap {
  return Object.entries(ROUTE_LAST_MODIFIED).map(([route, lastModified]) => ({
    url: `${SITE_URL}${route}`,
    lastModified,
  }));
}
