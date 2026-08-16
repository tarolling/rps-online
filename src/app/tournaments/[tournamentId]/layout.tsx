import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tournament",
  description: "Follow the bracket and live results for this Ranked RPS Online tournament.",
};

export default function TournamentDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
