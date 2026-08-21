"use client";

import {
  AuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  User,
  UserCredential,
  getAdditionalUserInfo,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import React, { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { postJSON } from "@/lib/api";
import { AppleIcon, GoogleIcon } from "@/components/icons";
import styles from "./OAuthSignInButtons.module.css";

// Username: 3–20 chars, letters/numbers/underscores only
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

function suggestUsername(user: User): string {
  const source = user.displayName ?? user.email?.split("@")[0] ?? "";
  const sanitized = source.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
  if (sanitized.length >= 3) return sanitized;
  return `player${Math.floor(1000 + Math.random() * 9000)}`;
}

type ProviderId = "google" | "apple";

type Props = {
  onSuccess: () => void;
};

export default function OAuthSignInButtons({ onSuccess }: Props) {
  const [pending, setPending] = useState<ProviderId | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [pendingUid, setPendingUid] = useState<string | null>(null);
  const [username, setUsername] = useState("");

  const finishSignIn = async (result: UserCredential) => {
    const idToken = await result.user.getIdToken();
    await postJSON("/api/login", { idToken });

    if (getAdditionalUserInfo(result)?.isNewUser) {
      setPendingUid(result.user.uid);
      setUsername(suggestUsername(result.user));
      setPending(null);
      return;
    }

    await postJSON("/api/initPlayer", { uid: result.user.uid });
    onSuccess();
  };

  // Apple's sign-in page frequently fails to complete inside a popup on
  // mobile Safari, so Apple goes through a full-page redirect instead of a
  // popup; this catches the result when the browser lands back on this page.
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (!result) return;
        setPending("apple");
        return finishSignIn(result);
      })
      .catch((e: unknown) => setError((e as Error).message))
      .finally(() => setPending(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClick = async (providerId: ProviderId, provider: AuthProvider, useRedirect: boolean) => {
    setError("");
    setPending(providerId);
    try {
      if (useRedirect) {
        await signInWithRedirect(auth, provider);
        return; // page navigates away; result is picked up by getRedirectResult on return
      }
      const result = await signInWithPopup(auth, provider);
      await finishSignIn(result);
      setPending(null);
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        setError((e as Error).message);
      }
      setPending(null);
    }
  };

  const handleConfirmUsername = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!pendingUid) return;
    if (!USERNAME_REGEX.test(username)) {
      setError("3-20 chars: letters, numbers, and underscores only.");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      const data = await postJSON<{ usernameExists: boolean }>("/api/checkUsername", { username });
      if (data.usernameExists) {
        setError("Username is already taken.");
        setSubmitting(false);
        return;
      }

      await postJSON("/api/initPlayer", { uid: pendingUid, username });
      onSuccess();
    } catch (e: unknown) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  };

  if (pendingUid) {
    return (
      <form onSubmit={handleConfirmUsername} className={styles.usernameForm}>
        <label className={styles.label} htmlFor="oauth-username">
          Choose a username
        </label>
        <input
          id="oauth-username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value.trim())}
          autoComplete="username"
          required
        />
        {error && <p className={styles.errorBanner}>{error}</p>}
        <button type="submit" className={styles.submitButton} disabled={submitting}>
          {submitting ? <span className={styles.spinner} /> : "Confirm"}
        </button>
      </form>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.divider}>
        <span>or</span>
      </div>
      {error && <p className={styles.errorBanner}>{error}</p>}
      <button
        type="button"
        className={styles.oauthButton}
        onClick={() => handleClick("google", new GoogleAuthProvider(), false)}
        disabled={pending !== null}
      >
        {pending === "google" ? <span className={styles.spinner} /> : (
          <>
            <GoogleIcon />
            <span>Continue with Google</span>
          </>
        )}
      </button>
      <button
        type="button"
        className={`${styles.oauthButton} ${styles.appleButton}`}
        onClick={() => handleClick("apple", new OAuthProvider("apple.com"), true)}
        disabled={pending !== null}
      >
        {pending === "apple" ? <span className={styles.spinner} /> : (
          <>
            <AppleIcon />
            <span>Continue with Apple</span>
          </>
        )}
      </button>
    </div>
  );
}
