"use client";

import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import OAuthSignInButtons from "@/components/OAuthSignInButtons";
import styles from "./RegisterPage.module.css";
import { EyeIcon, EyeOffIcon } from "@/components/icons";
import { postJSON } from "@/lib/api";
import { establishSession, signOutEverywhere } from "@/lib/session";
import { authErrorMessage } from "@/lib/authErrors";

// Username: 3–20 chars, letters/numbers/underscores only
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

function getPasswordStrength(password: string): { label: string; level: number } {
  if (password.length === 0) return { label: "", level: 0 };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  const levels = ["", "Weak", "Fair", "Good", "Strong"];
  return { label: levels[score], level: score };
}

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const router = useRouter();
  const { status } = useAuth();

  // Wait for AuthContext to reconcile the new session (Firebase identity plus
  // server cookie) before navigating, so the dashboard doesn't mount while it
  // still looks logged out.
  useEffect(() => {
    if (authReady && status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [authReady, status, router]);

  const strength = getPasswordStrength(password);
  const usernameError = username && !USERNAME_REGEX.test(username)
    ? "3-20 chars: letters, numbers, and underscores only."
    : "";
  const passwordMismatch = confirmPassword && password !== confirmPassword;

  const handleRegister = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!USERNAME_REGEX.test(username)) return setError("Invalid username format.");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    if (strength.level < 2) return setError("Please choose a stronger password.");

    setLoading(true);
    try {
      const data = await postJSON<{ usernameExists: boolean }>("/api/checkUsername", { username });
      if (data.usernameExists) return setError("Username is already taken.");

      const userInfo = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(userInfo.user);

      // Establish the session cookie first so initPlayer's auth check passes.
      await establishSession(userInfo.user, { force: true });
      await postJSON("/api/initPlayer", { uid: userInfo.user.uid, username });

      // Sign back out so the app state matches what we're about to tell them.
      // Creating an account signs you in client-side, and leaving it that way
      // contradicts both this message and the login page's rule that an
      // unverified account can't hold a session. Order matters: initPlayer
      // above needs the cookie.
      await signOutEverywhere();

      setMessage("Account created! Check your email to verify before logging in.");
    } catch (e: unknown) {
      setError(authErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSuccess = () => {
    setAuthReady(true);
  };

  return (
    <div className="app">
      <main className={styles.main}>
        <div className="card">
          <h2>Create Account</h2>
          <p className={styles.subtitle}>Join us. It only takes a minute.</p>

          <form onSubmit={handleRegister} className={styles.form} noValidate>
            {/* Username */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="username">Username</label>
              <input
                id="username"
                className={usernameError ? styles.inputError : ""}
                type="text"
                placeholder="cool_username"
                value={username}
                onChange={(e) => setUsername(e.target.value.trim())}
                autoComplete="username"
                required
              />
              {usernameError && <span className={styles.fieldError}>{usernameError}</span>}
            </div>

            {/* Email */}
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

            {/* Password */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="password">Password</label>
              <div className={styles.inputWrapper}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
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
              {password && (
                <div className={styles.strengthBar}>
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`${styles.strengthSegment} ${i <= strength.level ? styles[`strength${strength.level}`] : ""
                      }`}
                    />
                  ))}
                  <span className={styles.strengthLabel}>{strength.label}</span>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="confirmPassword">Confirm Password</label>
              <div className={styles.inputWrapper}>
                <input
                  id="confirmPassword"
                  className={passwordMismatch ? styles.inputError : ""}
                  type={showConfirm ? "text" : "password"}
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className={styles.eyeButton}
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {passwordMismatch && (
                <span className={styles.fieldError}>Passwords do not match.</span>
              )}
            </div>

            {error && <p className={styles.errorBanner}>{error}</p>}
            {message && <p className={styles.successBanner}>{message}</p>}

            <button type="submit" className={styles.submitButton} disabled={loading}>
              {loading ? <span className={styles.spinner} /> : "Create Account"}
            </button>
          </form>

          <OAuthSignInButtons onSuccess={handleOAuthSuccess} />

          <p className={styles.loginLink}>
                        Already have an account? <Link href="/login">Log in</Link>
          </p>
        </div>
      </main>
    </div>
  );
}