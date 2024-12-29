import React, { useCallback, useState } from "react";
import { Choices, GameStates } from '../types/gameTypes';
import { FIRST_TO, determineRoundWinner } from "../utils/matchmaking";
import Header from "./Header";
import setupAI from "../utils/aiAlgorithm";

const choiceMapTo = {
    'rock': 'R',
    'paper': 'P',
    'scissors': 'S'
};

const choiceMapFrom = {
    'R': 'rock',
    'P': 'paper',
    'S': 'scissors'
};

function AIPage() {
    const [playerChoice, setPlayerChoice] = useState(null);
    const [aiChoice, setAIChoice] = useState(null);
    const [gameData, setGameData] = useState({
        playerScore: 0,
        aiScore: 0,
        currentRound: 1,
        state: GameStates.IN_PROGRESS
    });

    const aiAlgorithm = setupAI();

    const handleChoice = useCallback(async (selectedChoice) => {
        if (!playerChoice && gameData.state === GameStates.IN_PROGRESS) {
            setPlayerChoice(selectedChoice);
            setTimeout(() => {
                resolveRound(selectedChoice);
            }, 1000);
        }
    }, [playerChoice]);

    const resolveRound = (selectedChoice) => {
        let tempAIChoice = aiAlgorithm(choiceMapTo[selectedChoice]);
        tempAIChoice = choiceMapFrom[tempAIChoice];
        setAIChoice(tempAIChoice);

        const roundWinner = determineRoundWinner(selectedChoice, tempAIChoice);
        let gameState;
        if (roundWinner === 'player1') {
            console.log('player wins');
            gameState = gameData.playerScore + 1 === FIRST_TO ? GameStates.FINISHED : GameStates.IN_PROGRESS;
            setGameData((prevData) => ({
                ...prevData,
                playerScore: gameData.playerScore++,
                currentRound: gameData.currentRound++,
                state: gameState
            }));
        } else if (roundWinner === 'player2') {
            console.log('ai wins');
            gameState = gameData.aiScore + 1 === FIRST_TO ? GameStates.FINISHED : GameStates.IN_PROGRESS;
            setGameData((prevData) => ({
                ...prevData,
                aiScore: gameData.aiScore++,
                currentRound: gameData.currentRound++,
                state: gameState
            }));
        }

        if (gameState !== GameStates.FINISHED) {
            setTimeout(() => {
                setPlayerChoice(null);
                setAIChoice(null);
            }, 1000);
        }
    };

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
                        <div className="username">Player</div>
                        <div className="score">{gameData.playerScore}</div>
                        {playerChoice && (
                            <div className="choice-display">
                                {getChoiceEmoji(playerChoice)}
                            </div>
                        )}
                    </div>

                    <div className="game-status">
                        <div className="round">Round {gameData.currentRound}</div>
                    </div>

                    <div className="player-info">
                        <h3>Opponent</h3>
                        <div className="username">AI</div>
                        <div className="score">{gameData.aiScore}</div>
                        {aiChoice && (
                            <div className="choice-display">
                                {getChoiceEmoji(aiChoice)}
                            </div>
                        )}
                    </div>
                </div>

                {gameData.state === GameStates.IN_PROGRESS && (
                    <div className="choices-container">
                        <div className="choices">
                            {Object.values(Choices).map((choiceOption) => (
                                <button
                                    key={choiceOption}
                                    onClick={() => handleChoice(choiceOption)}
                                    disabled={!!playerChoice}
                                    className={`choice-button ${playerChoice === choiceOption ? 'selected' : ''}`}
                                >
                                    <span className="choice-emoji">{getChoiceEmoji(choiceOption)}</span>
                                    <span className="choice-text">{choiceOption}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {gameData.state === GameStates.FINISHED && (
                    <div className="game-result">
                        <h2>{gameData.playerScore === FIRST_TO ? 'Victory!' : 'Defeat'}</h2>
                        <p className="final-score">Final Score: {gameData.playerScore} - {gameData.aiScore}</p>
                        <button className="play-again-button" onClick={() => window.location.href = '/playAI'}>
                            Play Again
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default AIPage;