import React, { useState } from 'react';

function MatchmakingPage({ userId, userRating }) {
    const [matchStatus, setMatchStatus] = useState('idle');
    const [opponent, setOpponent] = useState(null);

    const handleFindMatch = async () => {
        setMatchStatus('searching');
        try {
            const response = await fetch('/api/matchmaking', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    playerId: userId,
                    playerRating: userRating,
                }),
            });

            const data = await response.json();

            if (data.opponent) {
                setMatchStatus('matched');
                setOpponent(data.opponent);
            } else {
                setMatchStatus('queueing');
            }
        } catch (error) {
            console.error('Error finding match:', error);
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
