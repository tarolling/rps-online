import { signOut } from 'firebase/auth';
import React from 'react';
import { useNavigate } from 'react-router';
import { auth } from "../api/firebase";
import logo from '../assets/logo.png';
import '../styles/Header.css';

function Header() {
    const navigate = useNavigate();
    const isLoggedIn = !!auth.currentUser;
    const profilePicture = "../assets/logo.png";

    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate("/login");
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    return (
        <header className="header">
            <div className="header-logo">
                <img src={logo} alt="RPS Logo" className="logo" />
            </div>
            <nav className="header-nav">
                <a href="/" className="nav-link">Home</a>
                <a href="/leaderboard" className="nav-link">Leaderboard</a>
                <a href="/play" className="nav-link">Play</a>
                <a href="/rules" className="nav-link">Rules</a>
            </nav>
            <div className="header-user">
                {isLoggedIn ? (
                    <div className="profile-dropdown">
                        <img src={profilePicture} alt="Profile" className="profile-pic" />
                        <div className="dropdown-content">
                            <a href="/profile">Profile</a>
                            <a href="#" onClick={handleLogout}>Logout</a>
                        </div>
                    </div>
                ) : (
                    <div className="auth-buttons">
                        <a href="/login" className="button">Login</a>
                        <a href="/signup" className="button">Sign Up</a>
                    </div>
                )}
            </div>
        </header>
    );
}

export default Header;
