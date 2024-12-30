import { signOut } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
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
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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

    const closeAllMenus = () => {
        setIsDropdownOpen(false);
        setIsMobileMenuOpen(false);
    };

    useEffect(() => {
        if (windowWidth > 768) {
            setIsMobileMenuOpen(false);
        }
    }, [windowWidth]);

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

            {/* Hamburger Menu Button */}
            <button
                className={`hamburger-menu ${isMobileMenuOpen ? 'open' : ''}`}
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="Toggle navigation menu"
            >
                <span></span>
                <span></span>
                <span></span>
            </button>

            {/* Navigation Links */}
            <nav className={`header-nav ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
                <button onClick={() => handleNavigation('/')} className='nav-link'>
                    Home
                </button>
                <button onClick={() => handleNavigation('/dashboard')} className='nav-link'>
                    Dashboard
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
                <button onClick={() => handleNavigation('/clubs')} className="nav-link">
                    Clubs
                </button>

                {/* Mobile-only auth buttons */}
                <div className="mobile-auth">
                    {user ? (
                        <>
                            <button
                                onClick={() => handleNavigation(`/profile/${user.uid}`)}
                                className='nav-link mobile-profile'
                            >
                                Profile
                            </button>
                            <button
                                onClick={handleLogout}
                                className='nav-link mobile-logout'
                            >
                                Logout
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => handleNavigation('/login')}
                                className='nav-link'
                            >
                                Login
                            </button>
                            <button
                                onClick={() => handleNavigation('/register')}
                                className="nav-link"
                            >
                                Register
                            </button>
                        </>
                    )}
                </div>
            </nav>

            {/* Desktop User Menu */}
            <div className="header-user">
                {user ? (
                    <div
                        className="profile-dropdown"
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
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
