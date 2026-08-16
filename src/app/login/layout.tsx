import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log In",
  description: "Log in to Ranked RPS Online to play ranked Rock-Paper-Scissors matches.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
