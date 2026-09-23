import { SITE_URL } from "@/lib/seo";
import type { PlayMode, RankTier } from "@/types";

export type DiscordEvent =
  | { kind: "rankUp"; username: string; mode: PlayMode; matchId: string; fromTier: RankTier; toTier: RankTier }
  | { kind: "tournamentStart"; name: string; participantCount: number }
  | { kind: "tournamentChampion"; name: string; championUid: string; championUsername: string };

function hexToInt(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}

function buildEmbed(event: DiscordEvent): Record<string, unknown> {
  switch (event.kind) {
  case "rankUp":
    return {
      title: `${event.username} ranked up!`,
      description: `${event.fromTier.rank} ${event.fromTier.division ?? ""} → ${event.toTier.rank} ${event.toTier.division ?? ""} (${event.mode})`,
      color: hexToInt(event.toTier.color === "rainbow" ? "#f1c40f" : event.toTier.color),
      image: { url: `${SITE_URL}/match/${event.matchId}/opengraph-image` },
    };
  case "tournamentStart":
    return {
      title: `Tournament starting: ${event.name}`,
      description: `${event.participantCount} players`,
      color: hexToInt("#3498db"),
      image: { url: `${SITE_URL}/logo.png` },
    };
  case "tournamentChampion":
    return {
      title: `🏆 ${event.championUsername} won ${event.name}!`,
      color: hexToInt("#f1c40f"),
      image: { url: `${SITE_URL}/profile/${event.championUid}/opengraph-image` },
    };
  }
}

/**
 * Fire-and-forget notifier for notable site-wide events, posted to a single
 * global Discord channel via webhook. Never throws — a missing
 * DISCORD_WEBHOOK_URL (e.g. local dev) or a Discord-side failure must never
 * affect the caller (match recording, tournament start, etc.), mirroring the
 * best-effort shape of checkAndAwardMatchTitles in src/lib/titles.server.ts.
 */
export async function postDiscordEvent(event: DiscordEvent): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [buildEmbed(event)] }),
    });
    if (!res.ok) {
      console.error(`Discord webhook responded ${res.status}`);
    }
  } catch (err) {
    console.error("postDiscordEvent failed:", err);
  }
}
