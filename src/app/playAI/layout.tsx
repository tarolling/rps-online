import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Practice vs AI",
  description: "Warm up against an AI opponent before jumping into competitive ranked matches.",
  alternates: {
    canonical: "/playAI",
  },
};

export default function PlayAILayout({ children }: { children: React.ReactNode }) {
  return children;
}
