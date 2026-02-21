"use client";

import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import React, { useState } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import styles from "./RegisterPage.module.css";
import { EyeIcon, EyeOffIcon } from "@/components/icons";

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
            let response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/checkUsername`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username }),
            });
            if (!response.ok) throw new Error("Unable to check username; try again later.");

            const data = await response.json();
            if (data.usernameExists) throw new Error("Username is already taken.");

            const userInfo = await createUserWithEmailAndPassword(auth, email, password);
            await sendEmailVerification(userInfo.user);

            response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/initPlayer`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ uid: userInfo.user.uid, username }),
            });
            if (!response.ok) throw new Error("Unable to initialize player; contact support.");

            // get session token
            const idToken = await userInfo.user.getIdToken();
            const sessionRes = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken }),
            });
            if (!sessionRes.ok) throw new Error('Failed to create session.');

            setMessage("Account created! Check your email to verify before logging in.");
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="app">
            <Header />
            <main className={styles.main}>
                <div className="card">
                    <h2>Create Account</h2>
                    <p className={styles.subtitle}>Join us — it only takes a minute.</p>

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

                    <p className={styles.loginLink}>
                        Already have an account? <Link href="/login">Log in</Link>
                    </p>
                </div>
            </main>
            <Footer />
        </div>
    )
}