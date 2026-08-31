"use client";

import { sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import OAuthSignInButtons from "@/components/OAuthSignInButtons";
import styles from "./LoginPage.module.css";
import { EyeIcon, EyeOffIcon } from "@/components/icons";
import { postJSON } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  // Wait for AuthContext's onAuthStateChanged to pick up the new session
  // before navigating, so the dashboard doesn't mount while it still looks
  // logged out.
  useEffect(() => {
    if (authReady && user) {
      router.push("/dashboard");
    }
  }, [authReady, user, router]);

  const handleLogin = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const userInfo = await signInWithEmailAndPassword(auth, email, password);

      if (!userInfo.user.emailVerified) {
        await sendEmailVerification(userInfo.user);
        setError("Email not verified. We've resent the verification link; please check your inbox.");
        return;
      }

      // establish the session cookie first so subsequent authenticated calls succeed
      const idToken = await userInfo.user.getIdToken();
      await postJSON("/api/login", { idToken });
      await postJSON("/api/initPlayer", { uid: userInfo.user.uid });

      setAuthReady(true);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
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
      setError((e as Error).message);
    }
  };

  const handleOAuthSuccess = () => {
    setAuthReady(true);
  };

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