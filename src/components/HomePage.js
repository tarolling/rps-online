import React, { useEffect, useState } from "react";
import Footer from "./Footer";
import Header from "./Header";
import { useNavigate } from "react-router";
import "../styles/HomePage.css";
import formatRelativeTime from "../utils/formatRelativeTime";

function HomePage() {
    const navigate = useNavigate();
    const [recentMatches, setRecentMatches] = useState([]);

    const handleNavigation = (path) => {
        navigate(path);
    };

    useEffect(() => {
        const fetchRecentGames = async () => {
            const response = await fetch('/api/fetchRecentGames', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch recent games: ${response.statusText}`);
            }

            const data = await response.json();
            setRecentMatches(data.map((record) => ({
                ...record,
                timestamp: formatRelativeTime(record.timestamp);
            })));
        };

        fetchRecentGames();
    }, []);


    return (
        <div className="home-page">
            <Header />

            {/* Hero Section */}
            <section className="hero">
                <div className="hero-content">
                    <h1>Master the Game of Rock Paper Scissors</h1>
                    <p>Compete globally, climb the rankings, and become a champion!</p>
                    <div className="hero-buttons">
                        <button onClick={() => handleNavigation('/register')} className="cta-button">
                            Start Playing Now
                        </button>
                        <button onClick={() => handleNavigation('/rules')} className="secondary-button">
                            Learn the Rules
                        </button>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="features">
                <h2>Why Play With Us?</h2>
                <div className="features-grid">
                    <div className="feature-card">
                        <div className="feature-icon">🏆</div>
                        <h3>Competitive Leagues</h3>
                        <p>Join ranked matches and climb the global leaderboard</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">👥</div>
                        <h3>Active Community</h3>
                        <p>Connect with players worldwide and join clubs</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">🤖</div>
                        <h3>Practice Mode</h3>
                        <p>Sharpen your skills against our AI opponent</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">📊</div>
                        <h3>Detailed Stats</h3>
                        <p>Track your progress with comprehensive analytics</p>
                    </div>
                </div>
            </section>

            {/* Live Matches Section */}
            <section className="live-matches">
                <h2>Recent Matches</h2>
                <div className="matches-container">
                    {recentMatches.map((match, index) => (
                        <div key={index} className="match-card">
                            <div className="match-header">
                                <span className="match-time">{match.timestamp}</span>
                            </div>
                            <div className="match-content">
                                <div className="player">{match.player1}</div>
                                <div className="vs">
                                    <span className="score">{match.score}</span>
                                </div>
                                <div className="player">{match.player2}</div>
                            </div>
                            <div className="match-footer">
                                <span className="winner">Winner: {match.winner}</span>
                            </div>
                        </div>
                    ))}
                </div>
                <button onClick={() => handleNavigation('/leaderboard')} className="view-more-button">
                    View All Matches
                </button>
            </section>

            <Footer />
        </div>
    );
}

export default HomePage;