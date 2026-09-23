import type { Metadata } from "next";
import { getPlayerProfile } from "@/lib/fetchPlayer";
import { getRankTier, getDivisionLabel } from "@/lib/ranks";

const FALLBACK_METADATA: Metadata = {
  title: "Player Profile",
  description: "View player stats, match history, and rank progress in Ranked RPS Online.",
};

export async function generateMetadata({ params }: { params: Promise<{ userId: string }> }): Promise<Metadata> {
  const { userId } = await params;
  const profile = await getPlayerProfile(userId);
  if (!profile) return FALLBACK_METADATA;

  const topRating = Math.max(...Object.values(profile.ratings));
  const tier = getRankTier(topRating);

  return {
    title: `${profile.username}'s Profile — Ranked RPS Online`,
    description: `${profile.username} is ranked ${tier.rank} ${getDivisionLabel(tier.division)} in Ranked RPS Online.`,
  };
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
