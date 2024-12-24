import React, { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../api/firebase";
import { useNavigate } from "react-router";
import Header from "./Header";

function RegisterPage() {
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();

    const handleRegister = async (e) => {
        e.preventDefault();
        setError("");
        try {
            let response = await fetch('/api/checkUsername', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username: username })
            });

            if (!response.ok) {
                throw new Error("Unable to fetch usernames; try again later.");
            }

            const data = await response.json();
            if (data["usernameExists"]) {
                throw new Error("Username already exists!");
            }

            const userInfo = await createUserWithEmailAndPassword(auth, email, password);

            response = await fetch('/api/initPlayer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ uid: userInfo.user.uid, username: username })
            });

            if (!response.ok) {
                throw new Error("Unable to update player in database.");
            }
            navigate("/");
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div>
            <Header />
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
        </div>
    );
}

export default RegisterPage;