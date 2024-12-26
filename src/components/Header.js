import { signOut } from 'firebase/auth';
import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { auth } from "../api/firebase";
import logo from '../assets/logo.png';
import { useAuth } from '../Auth';
import '../index.css';
import '../styles/Header.css';

function Header() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate("/login", { replace: true });
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    const handleNavigation = (path) => {
        navigate(path);
    };

    return (
        <div className="header">
            <div className="header-logo">
                <img
                    src={logo}
                    alt="RPS Logo"
                    className="logo"
                    onClick={() => handleNavigation('/')}
                />
            </div>
            <nav className="header-nav">
                <button onClick={() => handleNavigation('/')} className='nav-link'>
                    Home
                </button>
                <button onClick={() => handleNavigation('/leaderboard')} className="nav-link">
                    Leaderboard
                </button>
                <button onClick={() => handleNavigation('/play')} className="nav-link">
                    Play
                </button>
                <button onClick={() => handleNavigation('/rules')} className="nav-link">
                    Rules
                </button>
            </nav>
            <div className="header-user">
                {user ? (
                    <div
                        className="profile-dropdown"
                        onMouseEnter={() => setIsDropdownOpen(true)}
                        onMouseLeave={() => setIsDropdownOpen(false)}
                    >
                        <img
                            src={user?.photoURL ?? logo}
                            alt="Profile"
                            className="profile-pic"
                        />
                        <div className={`dropdown-content ${isDropdownOpen ? 'show' : ''}`}>
                            <button
                                onClick={() => handleNavigation(`/profile/${user.uid}`)}
                                className='dropdown-item'
                            >
                                Profile
                            </button>
                            <button
                                onClick={handleLogout}
                                className='dropdown-item'
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="auth-buttons">
                        <button
                            onClick={() => handleNavigation('/login')}
                            className='button'
                        >
                            Login
                        </button>
                        <button
                            onClick={() => handleNavigation('/register')}
                            className="button"
                        >
                            Register
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Header;
