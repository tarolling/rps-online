// src/components/GamePage.js
import React, { useState } from 'react';

function GamePage() {
    const [choice, setChoice] = useState('');
    const [opponentChoice, setOpponentChoice] = useState('');
    const [result, setResult] = useState('');

    const playGame = (playerChoice) => {
        const choices = ['rock', 'paper', 'scissors'];
        const randomChoice = choices[Math.floor(Math.random() * choices.length)];
        setChoice(playerChoice);
        setOpponentChoice(randomChoice);

        if (playerChoice === randomChoice) {
            setResult('Draw');
        } else if (
            (playerChoice === 'rock' && randomChoice === 'scissors') ||
            (playerChoice === 'paper' && randomChoice === 'rock') ||
            (playerChoice === 'scissors' && randomChoice === 'paper')
        ) {
            setResult('You Win!');
        } else {
            setResult('You Lose!');
        }
    };

    return (
        <div className="container">
            <div className="card">
                <h2>Rock Paper Scissors</h2>
                <button onClick={() => playGame('rock')}>Rock</button>
                <button onClick={() => playGame('paper')}>Paper</button>
                <button onClick={() => playGame('scissors')}>Scissors</button>
                {choice && <p>You chose: {choice}</p>}
                {opponentChoice && <p>Opponent chose: {opponentChoice}</p>}
                {result && <p>Result: {result}</p>}
            </div>
        </div>
    );
}

export default GamePage;
