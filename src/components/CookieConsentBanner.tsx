"use client";

import { useCookieConsent } from "@/context/CookieConsentContext";
import styles from "./CookieConsentBanner.module.css";

export default function CookieConsentBanner() {
  const { consent, ready, accept, reject } = useCookieConsent();

  if (!ready || consent !== null) return null;

  return (
    <div className={styles.banner} role="dialog" aria-live="polite" aria-label="Cookie consent">
      <p className={styles.text}>
        We use a strictly necessary cookie to keep you signed in. With your consent, we&#39;d also
        like to use privacy-friendly analytics to see how the site is used. You can change your
        mind anytime in your browser&#39;s site settings.
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.rejectButton} onClick={reject}>
          Reject
        </button>
        <button type="button" className={styles.acceptButton} onClick={accept}>
          Accept
        </button>
      </div>
    </div>
  );
}
