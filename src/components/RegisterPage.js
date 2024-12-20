import React, { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../api/firebase";

function RegisterPage() {
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleRegister = async (e) => {
        e.preventDefault();
        setError("");
        try {
            const response = await fetch('/api/checkUsername', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username: username })
            });
            if (response.status !== 200) {
                throw new Error("Unable to fetch usernames; try again later.");
            }
            if (response.body["usernameExists"]) {
                throw new Error("Username already exists!");
            }
            await createUserWithEmailAndPassword(auth, email, password);
            alert("Registration successful!");
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="container">
            <h2>Register</h2>
            <form onSubmit={handleRegister}>
                <input
                    type="username"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                />
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
                <button type="submit">Register</button>
            </form>
            {error && <p style={{ color: "red" }}>{error}</p>}
        </div>
    );
}

export default RegisterPage;