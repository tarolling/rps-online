import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Play Ranked",
  description: "Queue up for a ranked rock paper scissors online match and climb the competitive ladder.",
  alternates: {
    canonical: "/play",
  },
};

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return children;
}
