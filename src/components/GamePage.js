import { getDatabase, onValue, ref, update } from 'firebase/database';
import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { useAuth } from '../Auth';
import '../styles/GamePage.css';
import { Choices, GameStates } from '../types/gameTypes';
import { resolveRound } from '../utils/matchmaking';
import Footer from './Footer';
import Header from './Header';


const ROUND_TIME = 30;


const GamePage = () => {
    const { gameID } = useParams();
    const { user } = useAuth();
    const playerID = user?.uid;

    const [game, setGame] = useState(null);
    const [loading, setLoading] = useState(true);
    const [choice, setChoice] = useState(null);
    const [roundOver, setRoundOver] = useState(false);
    const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
    const db = getDatabase();

    const isPlayer1 = game?.player1.id === playerID;
    const playerData = isPlayer1 ? game?.player1 : game?.player2;
    const opponentData = isPlayer1 ? game?.player2 : game?.player1;

    useEffect(() => {
        if (!gameID || !playerID) return;

        const gameRef = ref(db, `games/${gameID}`);
        const unsubscribe = onValue(gameRef, (snapshot) => {
            const gameData = snapshot.val();
            if (gameData) {
                setGame(gameData);
                setLoading(false);

                if (gameData.player1.choice && gameData.player2.choice &&
                    gameData.state === GameStates.IN_PROGRESS) {
                    setRoundOver(true);
                    setTimeout(() => {
                        resolveRound(gameID, user.uid);
                    }, 1000);
                }
            }

            if (gameData?.currentRound !== game?.currentRound) {
                setChoice(null);
                setTimeLeft(ROUND_TIME);
                setRoundOver(false);
            }
        });

        return () => unsubscribe();
    }, [gameID, playerID, user.uid, game]);

    useEffect(() => {
        let timer;
        if (game?.state === GameStates.IN_PROGRESS && !choice && timeLeft > 0) {
            timer = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        makeChoice(Choices.NONE);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }

        return () => clearInterval(timer);
    }, [game?.state, choice]);

    const makeChoice = useCallback(async (selectedChoice) => {
        if (!choice && game?.state === GameStates.IN_PROGRESS) {
            setChoice(selectedChoice);

            const playerKey = isPlayer1 ? 'player1' : 'player2';
            try {
                await update(ref(db, `games/${gameID}`), {
                    [`${playerKey}/choice`]: selectedChoice
                });
            } catch (error) {
                console.error('Error making choice:', error);
                setChoice(null);
            }
        }
    }, [choice, game]);

    const getChoiceEmoji = (choiceType) => {
        switch (choiceType) {
            case Choices.ROCK: return '✊';
            case Choices.PAPER: return '✋';
            case Choices.SCISSORS: return '✌️';
            default: return '';
        }
    };

    if (loading) {
        return (
            <div>
                <Header />
                <div className="game-container">
                    <div className="loading">Loading game...</div>
                </div>
                <Footer />
            </div>
        );
    }

    if (!game) {
        return (
            <div>
                <Header />
                <div className="game-container">
                    <div className="error-container">
                        <p className="error-text">Game not found</p>
                        <button className="retry-button" onClick={() => window.location.href = '/'}>
                            Return to Home
                        </button>
                    </div>
                </div>
                <Footer />
            </div>
        );
    }

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
                        <div className="username">{opponentData.username || 'Opponent'}</div>
                        <div className="score">{opponentData.score || 0}</div>
                        {game[isPlayer1 ? 'player2' : 'player1'].choice && (
                            <div className="choice-display">
                                {roundOver ?
                                    getChoiceEmoji(game[isPlayer1 ? 'player2' : 'player1'].choice) :
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
                        <h2>{game.winner === playerID ? 'Victory!' : 'Defeat'}</h2>
                        <p className="final-score">Final Score: {playerData.score} - {opponentData.score}</p>
                        <button className="play-again-button" onClick={() => window.location.href = '/play'}>
                            Play Again
                        </button>
                    </div>
                )}
            </div>
            <Footer />
        </div>
    );
};

export default GamePage;