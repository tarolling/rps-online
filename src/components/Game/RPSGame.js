import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

function RPSGame() {
    const { user } = useAuth();
    const [choice, setChoice] = useState('');
    const [result, setResult] = useState('');

    const playGame = async (playerChoice) => {
        setChoice(playerChoice);

        // mock API call to match endpoint
        const response = await fetch('/api/match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId: user.id, choice: playerChoice }),
        });
        const data = await response.json();
        setResult(data.result);
    };

    return (
        <div>
            <h2>Rock Paper Scissors</h2>
            <button onClick={() => playGame('rock')}>Rock</button>
            <button onClick={() => playGame('paper')}>Paper</button>
            <button onClick={() => playGame('scissors')}>Scissors</button>
            {choice && <p>You chose: {choice}</p>}
            {result && <p>Result: {result}</p>}
        </div>
    );
}

export default RPSGame;
