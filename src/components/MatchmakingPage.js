import { getDatabase, onValue, ref, remove } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../Auth';
import '../styles/MatchmakingPage.css';
import { findMatch } from '../utils/matchmaking';
import Header from './Header';

function MatchmakingPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [matchStatus, setMatchStatus] = useState('idle');
    const [queueCount, setQueueCount] = useState(0);
    const db = getDatabase();

    useEffect(() => {
        const queueRef = ref(db, 'matchmaking_queue');
        const unsubscribeQueueCount = onValue(queueRef, (snapshot) => {
            const queueData = snapshot.val() || {};
            setQueueCount(Object.keys(queueData).length);
        });

        return () => unsubscribeQueueCount();
    }, [db]);

    useEffect(() => {
        if (matchStatus === 'searching') {
            const queueRef = ref(db, `matchmaking_queue/${user.uid}`);
            const gamesRef = ref(db, 'games');

            const unsubscribeQueue = onValue(queueRef, (snapshot) => {
                if (!snapshot.exists()) {
                    onValue(gamesRef, (gameSnapshot) => {
                        const games = gameSnapshot.val() || {};
                        for (const [gameId, game] of Object.entries(games)) {
                            if (game.state === 'in_progress' &&
                                (game.player1.id === user.uid || game.player2.id === user.uid)) {
                                navigate(`/game/${gameId}`);
                                return;
                            }
                        }
                    }, { onlyOnce: true });
                }
            });

            return () => unsubscribeQueue();
        }
    }, [matchStatus, user.uid, navigate, db]);

    const handleFindMatch = async () => {
        setMatchStatus('searching');
        try {
            const result = await findMatch(user.uid, user.rating || 500);
            if (result?.gameId) {
                setMatchStatus('matched');
                navigate(`/game/${result.gameId}`);
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

    const renderQueueCount = () => (
        <div className="queue-counter">
            <p className="queue-text">
                Players in queue: <span className="queue-number">{queueCount}</span>
            </p>
        </div>
    );

    return (
        <div>
            <Header />
            <div className="matchmaking-container">
                <div className="matchmaking-card">
                    <h2 className="matchmaking-title">Matchmaking</h2>

                    {renderQueueCount()}

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
            </div>
        </div>
    );
}

export default MatchmakingPage;
