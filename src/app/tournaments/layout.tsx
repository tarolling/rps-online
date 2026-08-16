import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tournaments",
  description: "Browse upcoming and active Rock-Paper-Scissors tournaments in Ranked RPS Online.",
};

export default function TournamentsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
