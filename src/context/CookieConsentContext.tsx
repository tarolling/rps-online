"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type ConsentStatus = "accepted" | "rejected" | null;

const STORAGE_KEY = "cookieConsent";

interface CookieConsentContextType {
  // null until the stored choice (if any) has been read on mount, so the
  // banner doesn't flash on every page load for users who already decided.
  consent: ConsentStatus;
  ready: boolean;
  accept: () => void;
  reject: () => void;
}

const CookieConsentContext = createContext<CookieConsentContextType>({
  consent: null,
  ready: false,
  accept: () => { },
  reject: () => { },
});

export const useCookieConsent = () => useContext(CookieConsentContext);

export const CookieConsentProvider = ({ children }: { children: React.ReactNode }) => {
  const [consent, setConsent] = useState<ConsentStatus>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "accepted" || stored === "rejected") {
      setConsent(stored);
    }
    setReady(true);
  }, []);

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, "accepted");
    setConsent("accepted");
  };

  const reject = () => {
    localStorage.setItem(STORAGE_KEY, "rejected");
    setConsent("rejected");
  };

  return (
    <CookieConsentContext.Provider value={{ consent, ready, accept, reject }}>
      {children}
    </CookieConsentContext.Provider>
  );
};
