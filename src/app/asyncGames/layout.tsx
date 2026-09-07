import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Async Games",
  description: "Play rock paper scissors online at your own pace with async matches.",
  alternates: {
    canonical: "/asyncGames",
  },
};

export default function AsyncGamesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
