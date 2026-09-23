"use client";

import { sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import OAuthSignInButtons from "@/components/OAuthSignInButtons";
import styles from "./LoginPage.module.css";
import { EyeIcon, EyeOffIcon } from "@/components/icons";
import { postJSON } from "@/lib/api";
import { establishSession, signOutEverywhere } from "@/lib/session";
import { authErrorMessage } from "@/lib/authErrors";
import { sanitizeNextPath } from "@/lib/redirect";

function LoginPageInner() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useAuth();

  const nextPath = sanitizeNextPath(searchParams.get("next")) ?? "/dashboard";

  // Already signed in? Don't make them type a password again. This matters
  // for the returning-after-a-break case: the proxy bounces a missing cookie
  // here, AuthContext re-mints it from the live Firebase session a moment
  // later, and this sends them straight back where they were headed.
  // Guests are deliberately not redirected, so they can upgrade to a real
  // account from here.
  useEffect(() => {
    if (status === "authenticated") router.replace(nextPath);
  }, [status, nextPath, router]);

  const handleLogin = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const { user: signedIn } = await signInWithEmailAndPassword(auth, email, password);

      if (!signedIn.emailVerified) {
        await sendEmailVerification(signedIn)
          .catch((err) => console.warn("Could not resend the verification email:", err));
        // The sign-in itself already succeeded, so without this the visitor is
        // left client-authed and server-anonymous, with logged-in chrome.
        await signOutEverywhere();
        setError("Email not verified. We've resent the verification link; please check your inbox.");
        setLoading(false);
        return;
      }

      await establishSession(signedIn, { force: true });

      // Safety net only, back-filling a Player row for older accounts. At this
      // point the visitor is fully logged in, so a transient Neo4j blip must
      // not strand them on the login form.
      try {
        await postJSON("/api/initPlayer", { uid: signedIn.uid });
      } catch (err) {
        console.warn("initPlayer failed during login; continuing:", err);
      }

      // No setLoading(false) here: the button stays disabled until navigation
      // unmounts the form, so a slow redirect can't be double-submitted.
      router.replace(nextPath);
    } catch (e: unknown) {
      setError(authErrorMessage(e));
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError("Enter your email address above first.");
      return;
    }
    setError("");
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Password reset email sent! Check your inbox.");
    } catch (e: unknown) {
      setError(authErrorMessage(e));
    }
  };

  const handleOAuthSuccess = () => {
    router.replace(nextPath);
  };

  if (status === "loading" || status === "authenticated") {
    return (
      <div className="app">
        <main className={styles.main}>
          <div className="card">
            <span className={styles.spinner} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <main className={styles.main}>
        <div className="card">
          <h2>Welcome Back</h2>
          <p className={styles.subtitle}>Log in to your account.</p>

          <form onSubmit={handleLogin} className={styles.form} noValidate>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value.trim())}
                autoComplete="email"
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="password">Password</label>
              <div className={styles.inputWrapper}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className={styles.eyeButton}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              <button
                type="button"
                className={styles.forgotButton}
                onClick={handleResetPassword}
              >
                                Forgot password?
              </button>
            </div>

            {error && <p className={styles.errorBanner}>{error}</p>}
            {message && <p className={styles.successBanner}>{message}</p>}

            <button type="submit" className={styles.submitButton} disabled={loading}>
              {loading ? <span className={styles.spinner} /> : "Log In"}
            </button>
          </form>

          <OAuthSignInButtons onSuccess={handleOAuthSuccess} />

          <p className={styles.registerLink}>
                        Don&#39;t have an account? <Link href="/register">Sign up</Link>
          </p>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary to prerender.
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}