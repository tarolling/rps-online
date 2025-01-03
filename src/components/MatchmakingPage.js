import { get, getDatabase, onValue, ref, remove } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../Auth';
import '../styles/MatchmakingPage.css';
import { findMatch } from '../utils/matchmaking';
import Footer from './Footer';
import Header from './Header';

function MatchmakingPage() {
    const { user } = useAuth();
    const [matchStatus, setMatchStatus] = useState('idle');
    const [onlineCount, setOnlineCount] = useState(0);
    const navigate = useNavigate();
    const db = getDatabase();

    useEffect(() => {
        if (!user) return;

        const queueRef = ref(db, 'matchmaking_queue');
        const gamesRef = ref(db, 'games');
        const unsubscribeOnlineCount = onValue(queueRef, (queueSnapshot) => {
            onValue(gamesRef, (gamesSnapshot) => {
                const queueData = queueSnapshot.val() || {};
                const gamesData = gamesSnapshot.val() || {};

                const queueCount = Object.keys(queueData).length;
                const activeGamesCount = Object.keys(gamesData).length;
                const inGameCount = activeGamesCount * 2;

                const totalOnline = queueCount + inGameCount;

                setOnlineCount(totalOnline);
            });
        });


        const checkExistingGame = async () => {
            const gamesRef = ref(db, 'games');
            const snapshot = await get(gamesRef);
            const games = snapshot.val() || {};

            for (const [gameID, game] of Object.entries(games)) {
                if (game.state === 'in_progress' &&
                    (game.player1.id === user.uid || game.player2.id === user.uid)) {
                    navigate(`/game/${gameID}`);
                    return;
                }
            }
        };

        checkExistingGame();

        return () => {
            unsubscribeOnlineCount();
            if (matchStatus === 'searching') {
                remove(ref(db, `matchmaking_queue/${user.uid}`));
            }
        };
    }, [db, user?.uid, matchStatus]);

    const handleFindMatch = async () => {
        setMatchStatus('searching');
        try {
            let playerInfo = await fetch('/api/fetchPlayer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    uid: user.uid,
                }),
            });
            if (!playerInfo.ok) {
                throw new Error("Could not fetch player information");
            }

            playerInfo = await playerInfo.json();
            const result = await findMatch(user.uid, playerInfo.username, playerInfo.rating);

            if (result?.gameID) {
                setMatchStatus('matched');
                navigate(`/game/${result.gameID}`);
            } else if (result?.error === 'Match timeout') {
                setMatchStatus('idle');
            }
        } catch (err) {
            await remove(ref(db, `matchmaking_queue/${user.uid}`));
            console.error('Error:', err);
            setMatchStatus('error');
        }
    };

    const handleCancel = async () => {
        await remove(ref(db, `matchmaking_queue/${user.uid}`));
        setMatchStatus('idle');
    };

    const renderLoadingSpinner = () => (
        <div className="loading-spinner">
            <div className="spinner"></div>
        </div>
    );

    const renderOnlineCount = () => (
        <div className="queue-counter">
            <p className="queue-text">
                Players online: <span className="queue-number">{onlineCount}</span>
            </p>
        </div>
    );

    const handleNavigation = (path) => {
        navigate(path);
    };

    return (
        <div>
            <Header />
            <div className="matchmaking-container">
                {user && (
                    <div className="matchmaking-card">
                        <h2 className="matchmaking-title">Matchmaking</h2>
                        {renderOnlineCount()}
                        {matchStatus === 'idle' && (
                            <button
                                className="find-match-button"
                                onClick={handleFindMatch}
                            >
                                Find Match
                            </button>
                        )}

                        {matchStatus === 'searching' && (
                            <div className="status-container">
                                {renderLoadingSpinner()}
                                <p className="status-text">Searching for a match...</p>
                                <button
                                    className="cancel-button"
                                    onClick={handleCancel}
                                >
                                    Cancel
                                </button>
                            </div>
                        )}

                        {matchStatus === 'matched' && (
                            <div className="matched-container">
                                <div className="success-icon">✓</div>
                                <p className="match-found-text">Match Found!</p>
                                <p className="opponent-text">Joining...</p>
                            </div>
                        )}

                        {matchStatus === 'error' && (
                            <div className="error-container">
                                <p className="error-text">Error finding match. Please try again.</p>
                                <button
                                    className="retry-button"
                                    onClick={handleFindMatch}
                                >
                                    Retry
                                </button>
                            </div>
                        )}
                    </div>
                )}

                <div className="matchmaking-card">
                    <h2 className="matchmaking-title">Play against AI</h2>
                    <button
                        className="find-match-button"
                        onClick={() => handleNavigation('/playAI')}
                    >
                        Play
                    </button>
                </div>
            </div>
            <Footer />
        </div>
    );
}

export default MatchmakingPage;
