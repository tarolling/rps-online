import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Player Profile",
  description: "View player stats, match history, and rank progress in Ranked RPS Online.",
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
