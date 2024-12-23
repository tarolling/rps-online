import React, { useEffect, useState } from 'react';
import { getDatabase, ref, update, onValue } from 'firebase/database';
import { GameStates, Choices } from '../types/gameTypes';
import '../styles/GamePage.css';


const GamePage = ({ gameId, playerId }) => {
    const [game, setGame] = useState(null);
    const [choice, setChoice] = useState(null);
    const [timeLeft, setTimeLeft] = useState(30);
    const db = getDatabase();

    useEffect(() => {
        const gameRef = ref(db, `games/${gameId}`);
        const unsubscribe = onValue(gameRef, (snapshot) => {
            setGame(snapshot.val());
        });

        return () => unsubscribe();
    }, [gameId]);

    useEffect(() => {
        if (game?.currentRound && !choice && timeLeft > 0) {
            const timer = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);

            return () => clearInterval(timer);
        }
    }, [game, choice, timeLeft]);

    const makeChoice = async (selectedChoice) => {
        if (!choice) {
            setChoice(selectedChoice);
            const playerKey = game.player1.id === playerId ? 'player1' : 'player2';
            await update(ref(db, `games/${gameId}`), {
                [`${playerKey}Choice`]: selectedChoice
            });

            // Check if round is complete
            const otherPlayerKey = playerKey === 'player1' ? 'player2' : 'player1';
            if (game[`${otherPlayerKey}Choice`]) {
                await resolveRound(gameId);
            }
        }
    };

    return (
        <div className="game-container">
            <div className="game-header">
                <div className="player-info">
                    <h3>You</h3>
                    <div className="score">{game?.player1.id === playerId ? game?.player1.score : game?.player2.score}</div>
                </div>
                <div className="vs">VS</div>
                <div className="player-info">
                    <h3>Opponent</h3>
                    <div className="score">{game?.player1.id === playerId ? game?.player2.score : game?.player1.score}</div>
                </div>
            </div>

            <div className="game-status">
                <div className="round">Round {game?.currentRound}</div>
                <div className="timer">Time Left: {timeLeft}s</div>
            </div>

            <div className="choices">
                {Object.values(Choices).map((choiceOption) => (
                    <button
                        key={choiceOption}
                        onClick={() => makeChoice(choiceOption)}
                        disabled={!!choice}
                        className={`choice-button ${choice === choiceOption ? 'selected' : ''}`}
                    >
                        {choiceOption}
                    </button>
                ))}
            </div>

            {game?.state === GameStates.FINISHED && (
                <div className="game-result">
                    <h2>Game Over!</h2>
                    <p>{game.winner === playerId ? 'You Won!' : 'You Lost!'}</p>
                </div>
            )}
        </div>
    );
};

export default GamePage;