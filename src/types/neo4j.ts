// these are supposed to align with the nodes stored in neo4j

import { DateTime } from "neo4j-driver";

////////////////////////////////////////////////////////////////
// Types
////////////////////////////////////////////////////////////////

export type ClubAvailability = "Open" | "Invite" | "Closed";
export type ClubRole = "Member" | "Founder";
export type GameMode = "ranked" | "casual" | "tournament" | "challenge";
export type TitleRarity = "common" | "rare" | "epic" | "legendary";
export type TournamentPlayerCap = 8 | 16 | 32 | 64;
export type Division = 1 | 2 | 3 | null; // null = Infinity rank

////////////////////////////////////////////////////////////////
// Enums
////////////////////////////////////////////////////////////////

export enum Choice {
    Rock = "ROCK",
    Paper = "PAPER",
    Scissors = "SCISSORS",
}

export enum MatchResult {
    Win = "W",
    Loss = "L",
    WinAfk = "W_AFK",
    LossAfk = "L_AFK",
    DrawAfk = "D_AFK"
}

export enum TournamentStatus {
    Registration = "REGISTRATION",
    InProgress = "IN_PROGRESS",
    Completed = "COMPLETED"
}

export enum MatchStatus {
    Waiting = "WAITING",
    InProgress = "IN_PROGRESS",
    Completed = "COMPLETED",
    Cancelled = "CANCELLED",
}

export enum TournamentMatchStatus {
    Waiting = "WAITING",
    Bye = "BYE",
    Completed = "COMPLETED",
}

////////////////////////////////////////////////////////////////
// Nodes
////////////////////////////////////////////////////////////////

export interface Player {
    uid: string;
    username: string;
    rating: number;
    created: number;
    lastSeen: number;
};

export interface Club {
    availability: ClubAvailability;
    name: string;
    tag: string;
};

export interface Match {
    id: string;
    mode: GameMode;
    status: MatchStatus;
    timestamp: DateTime;
    totalRounds: number;
    winnerId: string;
    // Optional: only present for tournament matches
    tournamentId?: string;
    matchId?: string;
    // Set to true for records migrated from legacy PLAYED relationships
    legacy?: boolean;
};

export interface Round {
    roundNumber: number;
    p1Choice: Choice;
    p2Choice: Choice;
    winnerId: string | null; // null = draw
};

export interface Title {
    id: string;
    name: string;
    description: string;
    rarity: TitleRarity;
};

////////////////////////////////////////////////////////////////
// Relationships
////////////////////////////////////////////////////////////////

/** On (Player)-[:PARTICIPATED_IN]->(Match) */
export type ParticipatedIn = {
    score: number;
    result: MatchResult;
    ratingBefore: number;
    ratingAfter?: number; // not set on legacy records
    rocks: number;
    papers: number;
    scissors: number;
};

/** On (Player)-[:EARNED_TITLE]->(Title) */
export type EarnedTitle = {
    awardedAt: DateTime;
};

////////////////////////////////////////////////////////////////
// Deprecated
////////////////////////////////////////////////////////////////

/**
 * @deprecated Use Match node + ParticipatedIn relationship instead
 */
export type Played = {
    opponentRocks: number;
    opponentPapers: number;
    opponentScissors: number;
    opponentScore: number;
    opponentRating: number;
    playerRocks: number;
    playerPapers: number;
    playerScissors: number;
    playerScore: number;
    playerRating: number;
    result: "W" | "L";
    timestamp: DateTime;
    totalRounds: number;
};