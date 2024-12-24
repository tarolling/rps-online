import { getDatabase, onValue, ref, update } from 'firebase/database';
import React, { useEffect, useState, useCallback } from 'react';
import '../styles/GamePage.css';
import { Choices, GameStates } from '../types/gameTypes';
import { resolveRound } from '../utils/matchmaking';
import Header from './Header';


const ROUND_TIME = 30;


const GamePage = ({ gameId, playerId }) => {
    const [game, setGame] = useState(null);
    const [choice, setChoice] = useState(null);
    const [timeLeft, setTimeLeft] = useState(30);
    const db = getDatabase();

    const isPlayer1 = game?.player1.id === playerId;
    const playerData = isPlayer1 ? game?.player1 : game?.player2;
    const opponentData = isPlayer1 ? game?.player2 : game?.player1;

    useEffect(() => {
        const gameRef = ref(db, `games/${gameId}`);
        const unsubscribe = onValue(gameRef, (snapshot) => {
            const gameData = snapshot.val();
            setGame(gameData);

            if (gameData?.currentRound !== game?.currentRound) {
                setChoice(null);
                setTimeLeft(ROUND_TIME);
            }
        });

        return () => unsubscribe();
    }, [gameId, game?.currentRound]);

    useEffect(() => {
        let timer;

        if (game?.state === GameStates.IN_PROGRESS && !choice && timeLeft > 0) {
            timer = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        // Auto-select rock if time runs out
                        makeChoice(Choices.ROCK);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }

        return () => clearInterval(timer);
    }, [game?.state, choice, timeLeft]);

    const makeChoice = useCallback(async (selectedChoice) => {
        if (!choice && game?.state === GameStates.IN_PROGRESS) {
            setChoice(selectedChoice);
            const playerKey = isPlayer1 ? 'player1' : 'player2';

            try {
                await update(ref(db, `games/${gameId}`), {
                    [`${playerKey}Choice`]: selectedChoice
                });

                const otherPlayerKey = isPlayer1 ? 'player2' : 'player1';
                if (game[`${otherPlayerKey}Choice`]) {
                    await resolveRound(gameId);
                }
            } catch (error) {
                console.error('Error making choice:', error);
                setChoice(null);
            }
        }
    }, [choice, game, gameId, isPlayer1, db]);

    if (!game) {
        return <div className="loading">Loading game...</div>;
    }

    const getChoiceEmoji = (choiceType) => {
        switch (choiceType) {
            case Choices.ROCK: return '✊';
            case Choices.PAPER: return '✋';
            case Choices.SCISSORS: return '✌️';
            default: return '';
        }
    };

    return (
        <div>
            <Header />
            <div className="game-container">
                <div className="game-header">
                    <div className="player-info">
                        <h3>You</h3>
                        <div className="username">{playerData?.username || 'Player'}</div>
                        <div className="score">{playerData?.score || 0}</div>
                        {choice && (
                            <div className="choice-display">
                                {getChoiceEmoji(choice)}
                            </div>
                        )}
                    </div>

                    <div className="game-status">
                        <div className="round">Round {game.currentRound}</div>
                        <div className={`timer ${timeLeft <= 10 ? 'timer-warning' : ''}`}>
                            {timeLeft}s
                        </div>
                    </div>

                    <div className="player-info">
                        <h3>Opponent</h3>
                        <div className="username">{opponentData?.username || 'Opponent'}</div>
                        <div className="score">{opponentData?.score || 0}</div>
                        {game[`${isPlayer1 ? 'player2' : 'player1'}Choice`] && (
                            <div className="choice-display">
                                {game.state === GameStates.FINISHED ?
                                    getChoiceEmoji(game[`${isPlayer1 ? 'player2' : 'player1'}Choice`]) :
                                    '🤔'}
                            </div>
                        )}
                    </div>
                </div>

                {game.state === GameStates.IN_PROGRESS && (
                    <div className="choices-container">
                        <div className="choices">
                            {Object.values(Choices).map((choiceOption) => (
                                <button
                                    key={choiceOption}
                                    onClick={() => makeChoice(choiceOption)}
                                    disabled={!!choice}
                                    className={`choice-button ${choice === choiceOption ? 'selected' : ''}`}
                                >
                                    <span className="choice-emoji">{getChoiceEmoji(choiceOption)}</span>
                                    <span className="choice-text">{choiceOption}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {game.state === GameStates.FINISHED && (
                    <div className="game-result">
                        <h2>{game.winner === playerId ? 'Victory!' : 'Defeat'}</h2>
                        <p className="final-score">Final Score: {playerData.score} - {opponentData.score}</p>
                        <button className="play-again-button" onClick={() => window.location.href = '/'}>
                            Play Again
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GamePage;