"use client";

import { useCallback, useState } from "react";
import { RoundData } from "@/types";
import setupAI from "@/lib/aiAlgorithm";
import { FIRST_TO, determineRoundWinner } from "@/lib/matchmaking";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import styles from "@/styles/game.module.css";
import { Choice, MatchStatus } from "@/types/neo4j";

// ── Types ─────────────────────────────────────────────────────────────────────

type GameData = {
    playerScore: number;
    aiScore: number;
    currentRound: number;
    state: MatchStatus;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const CHOICE_EMOJI: Record<Choice, string> = {
  [Choice.Rock]: "✊",
  [Choice.Paper]: "✋",
  [Choice.Scissors]: "✌️",
};

// Maps between full choice names and the single-char keys the AI algorithm uses
const TO_AI: Record<Choice, string> = {
  [Choice.Rock]: "R",
  [Choice.Paper]: "P",
  [Choice.Scissors]: "S",
};

const FROM_AI: Record<string, Choice> = {
  "R": Choice.Rock,
  "P": Choice.Paper,
  "S": Choice.Scissors,
};

const PLAYABLE_CHOICES = [Choice.Rock, Choice.Paper, Choice.Scissors];

// ── Component ─────────────────────────────────────────────────────────────────

export default function PlayAIPage() {
  const [playerChoice, setPlayerChoice] = useState<Choice | null>(null);
  const [aiChoice, setAIChoice] = useState<Choice | null>(null);
  const [gameData, setGameData] = useState<GameData>({
    playerScore: 0,
    aiScore: 0,
    currentRound: 1,
    state: MatchStatus.InProgress,
  });
  const [rounds, setRounds] = useState<Record<number, RoundData>>({});

  // AI instance is stable across renders
  const [aiAlgorithm] = useState(() => setupAI());

  const resolveRound = useCallback((selected: Choice) => {
    const aiResponse = FROM_AI[aiAlgorithm(TO_AI[selected])];
    setAIChoice(aiResponse);

    const roundWinner = determineRoundWinner(selected, aiResponse);

    setGameData((prev) => {
      const playerScore = roundWinner === "player1" ? prev.playerScore + 1 : prev.playerScore;
      const aiScore = roundWinner === "player2" ? prev.aiScore + 1 : prev.aiScore;
      const state = playerScore >= FIRST_TO || aiScore >= FIRST_TO
        ? MatchStatus.Completed
        : MatchStatus.InProgress;

      setRounds((prevRounds) => ({
        ...prevRounds,
        [prev.currentRound]: {
          player1Choice: selected,
          player2Choice: aiResponse,
          winner: roundWinner ?? "draw",
        },
      }));

      return { playerScore, aiScore, currentRound: prev.currentRound + 1, state };
    });

    setTimeout(() => {
      setPlayerChoice(null);
      setAIChoice(null);
    }, 1500);
  }, [aiAlgorithm]);

  const handleChoice = useCallback((selected: Choice) => {
    if (playerChoice || gameData.state !== MatchStatus.InProgress) return;
    setPlayerChoice(selected);
    setTimeout(() => resolveRound(selected), 800);
  }, [playerChoice, gameData.state, resolveRound]);

  const handlePlayAgain = () => {
    setPlayerChoice(null);
    setAIChoice(null);
    setRounds({});
    setGameData({
      playerScore: 0,
      aiScore: 0,
      currentRound: 1,
      state: MatchStatus.InProgress,
    });
  };

  const isFinished = gameData.state === MatchStatus.Completed;
  const playerWon = gameData.playerScore >= FIRST_TO;

  return (
    <div className="app">
      <Header />
      <main className={styles.main}>
        <div className={styles.gameContainer}>

          {/* ── Scoreboard ── */}
          <div className={styles.scoreboard}>
            <PlayerPanel
              label="You"
              name="Player"
              score={gameData.playerScore}
              choice={playerChoice}
            />

            <div className={styles.vsBlock}>
              <span className={styles.roundLabel}>Round</span>
              <span className={styles.roundNumber}>{gameData.currentRound}</span>
              <span className={styles.vs}>VS</span>
            </div>

            <PlayerPanel
              label="Opponent"
              name="AI"
              score={gameData.aiScore}
              choice={aiChoice}
              reveal={!!aiChoice}
            />
          </div>

          {/* ── Choice buttons ── */}
          {!isFinished && (
            <div className={styles.choices}>
              {PLAYABLE_CHOICES.map((choice) => (
                <button
                  key={choice}
                  onClick={() => handleChoice(choice)}
                  disabled={!!playerChoice}
                  className={`${styles.choiceButton} ${playerChoice === choice ? styles.selected : ""}`}
                >
                  <span className={styles.choiceEmoji}>{CHOICE_EMOJI[choice]}</span>
                  <span className={styles.choiceLabel}>{choice}</span>
                </button>
              ))}
            </div>
          )}

          {Object.keys(rounds).length > 0 && (
            <RoundHistory rounds={rounds} isPlayer1={true} />
          )}

          {/* ── Result ── */}
          {isFinished && (
            <div className={styles.result}>
              <p className={`${styles.resultLabel} ${playerWon ? styles.victory : styles.defeat}`}>
                {playerWon ? "Victory!" : "Defeat"}
              </p>
              <p className={styles.finalScore}>
                {gameData.playerScore} - {gameData.aiScore}
              </p>
              <button className={styles.playAgainButton} onClick={handlePlayAgain}>
                                Play Again
              </button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

type PlayerPanelProps = {
    label: string;
    name: string;
    score: number;
    choice: Choice | null;
    reveal?: boolean;
};

function PlayerPanel({ label, name, score, choice, reveal = true }: PlayerPanelProps) {
  return (
    <div className={styles.playerPanel}>
      <span className={styles.playerLabel}>{label}</span>
      <span className={styles.playerName}>{name}</span>
      <span className={styles.playerScore}>{score}</span>
      <div className={`${styles.choiceDisplay} ${choice && reveal ? styles.choiceVisible : ""}`}>
        {choice && reveal ? CHOICE_EMOJI[choice] : ""}
      </div>
    </div>
  );
}

function RoundHistory({ rounds, isPlayer1 }: { rounds: Record<number, RoundData>; isPlayer1: boolean }) {
  const entries = Object.entries(rounds).sort(([a], [b]) => Number(a) - Number(b));

  return (
    <div className={styles.roundHistory}>
      <div className={styles.roundHistoryHeader}>
        <span>You</span>
        <span />
        <span>Opponent</span>
      </div>
      {entries.map(([round, data]) => {
        const myChoice = isPlayer1 ? data.player1Choice : data.player2Choice;
        const theirChoice = isPlayer1 ? data.player2Choice : data.player1Choice;
        const myKey = isPlayer1 ? "player1" : "player2";
        const outcome = data.winner === myKey ? "win" : data.winner === "draw" ? "draw" : "loss";

        return (
          <div key={round} className={`${styles.roundHistoryRow} ${styles[outcome]}`}>
            <span>{myChoice === null ? "⏱️" : CHOICE_EMOJI[myChoice]}</span>
            <span className={styles.roundHistoryLabel}>R{round}</span>
            <span>{theirChoice === null ? "⏱️" : CHOICE_EMOJI[theirChoice]}</span>
          </div>
        );
      })}
    </div>
  );
}