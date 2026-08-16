import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Create a free Ranked RPS Online account and start climbing the ranked ladder.",
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
