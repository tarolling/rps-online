import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Clubs",
  description: "Join or create a club, team up, and compete together in Ranked RPS Online.",
};

export default function ClubsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
