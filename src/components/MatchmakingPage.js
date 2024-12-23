import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../Auth';
import { onValue, ref, getDatabase } from 'firebase/database';

function MatchmakingPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [matchStatus, setMatchStatus] = useState('idle');
    const db = getDatabase();

    useEffect(() => {
        if (matchStatus === 'queueing') {
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
    }, [matchStatus, user.uid, navigate]);

    const handleFindMatch = async () => {
        setMatchStatus('searching');
        try {
            const result = await findMatch(user.uid, user.rating || 500);
            if (result?.gameId) {
                navigate(`/game/${result.gameId}`);
            } else {
                setMatchStatus('queueing');
            }
            // const response = await fetch('/api/matchmaking', {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json',
            //     },
            //     body: JSON.stringify({
            //         playerId: userId,
            //         playerRating: userRating,
            //     }),
            // });

            // const data = await response.json();

            // if (data.opponent) {
            //     setMatchStatus('matched');
            //     setOpponent(data.opponent);
            // } else {
            //     setMatchStatus('queueing');
            // }
        } catch (err) {
            console.error('Error:', err);
            setMatchStatus('error');
        }
    };

    return (
        <div>
            {matchStatus === 'idle' && (
                <button onClick={handleFindMatch}>Find Match</button>
            )}
            {matchStatus === 'searching' && <p>Searching for a match...</p>}
            {matchStatus === 'queueing' && <p>Still in queue. Waiting for an opponent...</p>}
            {matchStatus === 'matched' && opponent && (
                <div>
                    <p>Match Found!</p>
                    <p>Opponent: {opponent.username}</p>
                </div>
            )}
            {matchStatus === 'error' && <p>Error finding match. Please try again.</p>}
        </div>
    );
}

export default MatchmakingPage;
