export type Rank = "Recruit" | "Apprentice" | "Veteran" | "Expert" | "Master" | "Grandmaster" | "Ultimate" | "Infinity";

export interface RankTier {
    rank: Rank;
    division: 1 | 2 | 3 | null; // null for Infinity
    minRating: number;
    color: string;
    glow: string;
}

// rank tier definitions; mainly for UI
export const RANK_TIERS: RankTier[] = [
  { rank: "Recruit", division: 1, minRating: 0, color: "#8b9099", glow: "rgba(139,144,153,0.4)" },
  { rank: "Recruit", division: 2, minRating: 100, color: "#8b9099", glow: "rgba(139,144,153,0.4)" },
  { rank: "Recruit", division: 3, minRating: 200, color: "#8b9099", glow: "rgba(139,144,153,0.4)" },
  { rank: "Apprentice", division: 1, minRating: 300, color: "#4caf75", glow: "rgba(76,175,117,0.4)" },
  { rank: "Apprentice", division: 2, minRating: 450, color: "#4caf75", glow: "rgba(76,175,117,0.4)" },
  { rank: "Apprentice", division: 3, minRating: 600, color: "#4caf75", glow: "rgba(76,175,117,0.4)" },
  { rank: "Veteran", division: 1, minRating: 750, color: "#3498db", glow: "rgba(52,152,219,0.4)" },
  { rank: "Veteran", division: 2, minRating: 950, color: "#3498db", glow: "rgba(52,152,219,0.4)" },
  { rank: "Veteran", division: 3, minRating: 1150, color: "#3498db", glow: "rgba(52,152,219,0.4)" },
  { rank: "Expert", division: 1, minRating: 1350, color: "#9b59b6", glow: "rgba(155,89,182,0.4)" },
  { rank: "Expert", division: 2, minRating: 1600, color: "#9b59b6", glow: "rgba(155,89,182,0.4)" },
  { rank: "Expert", division: 3, minRating: 1850, color: "#9b59b6", glow: "rgba(155,89,182,0.4)" },
  { rank: "Master", division: 1, minRating: 2100, color: "#f1c40f", glow: "rgba(241,196,15,0.4)" },
  { rank: "Master", division: 2, minRating: 2350, color: "#f1c40f", glow: "rgba(241,196,15,0.4)" },
  { rank: "Master", division: 3, minRating: 2600, color: "#f1c40f", glow: "rgba(241,196,15,0.4)" },
  { rank: "Grandmaster", division: 1, minRating: 2850, color: "#e67e22", glow: "rgba(230,126,34,0.5)" },
  { rank: "Grandmaster", division: 2, minRating: 3050, color: "#e67e22", glow: "rgba(230,126,34,0.5)" },
  { rank: "Grandmaster", division: 3, minRating: 3250, color: "#e67e22", glow: "rgba(230,126,34,0.5)" },
  { rank: "Ultimate", division: 1, minRating: 3400, color: "#e74c3c", glow: "rgba(231,76,60,0.5)" },
  { rank: "Ultimate", division: 2, minRating: 3550, color: "#e74c3c", glow: "rgba(231,76,60,0.5)" },
  { rank: "Ultimate", division: 3, minRating: 3700, color: "#e74c3c", glow: "rgba(231,76,60,0.5)" },
  { rank: "Infinity", division: null, minRating: 3850, color: "rainbow", glow: "rgba(255,255,255,0.3)" },
];

export function getRankTier(rating: number): RankTier {
  return [...RANK_TIERS]
    .reverse()
    .find((tier) => rating >= tier.minRating) ?? RANK_TIERS[0];
}

export function getDivisionLabel(division: 1 | 2 | 3 | null): string {
  if (division === null) return "";
  return ["I", "II", "III"][division - 1];
}