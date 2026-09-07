import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Track your ranked rock paper scissors stats, recent matches, and progress.",
  alternates: {
    canonical: "/dashboard",
  },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
