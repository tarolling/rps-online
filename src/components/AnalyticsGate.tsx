"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { useCookieConsent } from "@/context/CookieConsentContext";

// Vercel Analytics/Speed Insights only load once the visitor has accepted
// cookies, so nothing runs until then.
export default function AnalyticsGate() {
  const { consent } = useCookieConsent();

  if (consent !== "accepted") return null;

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
