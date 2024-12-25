import { sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import React, { useState } from "react";
import { useNavigate } from "react-router";
import { auth } from "../api/firebase";
import Header from "./Header";

function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");
        setMessage("");
        try {
            const userInfo = await signInWithEmailAndPassword(auth, email, password);

            if (!userInfo.user.emailVerified) {
                setError("Please verify your email before logging in. Check your inbox for the verification link.");
                await sendEmailVerification(userInfo.user);
                return;
            }

            const response = await fetch('/api/initPlayer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ uid: userInfo.user.uid })
            });

            if (!response.ok) {
                throw new Error("Unable to update player in database.");
            }
            navigate('/');
        } catch (err) {
            setError(err.message);
        }
    };

    const handleResetPassword = async () => {
        if (!email) {
            setError("Please enter your email address first.");
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            setMessage("Password reset email sent! Check your inbox.");
            setError("");
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div>
            <Header />
            <div className="container">
                <h2>Login</h2>
                <form onSubmit={handleLogin}>
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    <button type="submit">Login</button>
                    <button
                        onClick={handleResetPassword}
                        className="reset-password-btn"
                    >
                        Forgot Password?
                    </button>
                </form>
                {error && <p style={{ color: "red" }}>{error}</p>}
                {message && <p style={{ color: "green" }}>{message}</p>}
            </div>
        </div>
    );
}

export default LoginPage;