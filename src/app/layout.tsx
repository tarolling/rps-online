import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/context/AuthContext";
import { CookieConsentProvider } from "@/context/CookieConsentContext";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import AnalyticsGate from "@/components/AnalyticsGate";
import "./global.css";

const SITE_URL = "https://ranked-rps.com";
const SITE_NAME = "Ranked RPS";
const SITE_DESCRIPTION = "Competitive Rock-Paper-Scissors matchmaking. Climb ranked ladders, form clubs, and battle players worldwide.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} - Rock-Paper-Scissors Matchmaking`,
    template: `%s - ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} - Rock-Paper-Scissors Matchmaking`,
    description: SITE_DESCRIPTION,
    images: [{ url: "/logo.png" }],
  },
  twitter: {
    card: "summary",
    title: `${SITE_NAME} - Rock-Paper-Scissors Matchmaking`,
    description: SITE_DESCRIPTION,
    images: ["/logo.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <CookieConsentProvider>
          <AuthProvider>{children}</AuthProvider>
          <CookieConsentBanner />
          <AnalyticsGate />
        </CookieConsentProvider>
      </body>
    </html>
  );
}
