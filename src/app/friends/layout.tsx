import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Friends",
  description: "Manage your friends list and challenge rivals in Ranked RPS Online.",
  alternates: {
    canonical: "/friends",
  },
};

export default function FriendsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
