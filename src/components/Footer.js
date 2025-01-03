import React from 'react';
import { useNavigate } from 'react-router';
import logo from '../assets/logo.png';
import '../styles/Footer.css';

function Footer() {
    const navigate = useNavigate();

    const handleNavigation = (path) => {
        navigate(path);
    };

    return (
        <footer className="footer">
            <div className="footer-content">
                <div className="footer-section">
                    <img
                        src={logo}
                        alt="RPS Logo"
                        className="footer-logo"
                        onClick={() => handleNavigation('/')}
                    />
                    <p className="footer-tagline">Play. Compete. Conquer.</p>
                </div>

                <div className="footer-section">
                    <h3>Navigation</h3>
                    <button onClick={() => handleNavigation('/')} className='footer-link'>
                        Home
                    </button>
                    <button onClick={() => handleNavigation('/dashboard')} className='footer-link'>
                        Dashboard
                    </button>
                    <button onClick={() => handleNavigation('/leaderboard')} className="footer-link">
                        Leaderboard
                    </button>
                    <button onClick={() => handleNavigation('/play')} className="footer-link">
                        Play
                    </button>
                    <button onClick={() => handleNavigation('/rules')} className="footer-link">
                        Rules
                    </button>
                    <button onClick={() => handleNavigation('/clubs')} className="footer-link">
                        Clubs
                    </button>
                    <button onClick={() => handleNavigation('/tournaments')} className="footer-link">
                        Tournaments
                    </button>
                </div>

                <div className="footer-section">
                    <h3>Community</h3>
                    <a
                        href="https://discord.gg/9msWyzbf84"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="footer-social-link"
                    >
                        Discord
                    </a>
                    <a
                        href="https://github.com/tarolling/rps-online"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="footer-social-link"
                    >
                        GitHub
                    </a>
                    <a
                        href="https://www.instagram.com/rankedrps/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="footer-social-link"
                    >
                        Instagram
                    </a>
                    <a
                        href="https://x.com/RankedRPS"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="footer-social-link"
                    >
                        X
                    </a>
                    <a
                        href="https://www.reddit.com/r/RankedRPS/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="footer-social-link"
                    >
                        Reddit
                    </a>
                </div>
            </div>
            <div className="footer-bottom">
                <p>&copy; {new Date().getFullYear()} Ranked RPS. All rights reserved.</p>
            </div>
        </footer>
    );
}

export default Footer;