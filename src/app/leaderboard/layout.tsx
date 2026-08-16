import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "See the top-ranked Rock-Paper-Scissors players in Ranked RPS Online.",
};

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
