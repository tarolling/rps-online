/**
 * Enums
 */

import { DateTime } from "neo4j-driver";

export enum GameState {
    Waiting = "WAITING",
    InProgress = "IN_PROGRESS",
    Finished = "FINISHED",
    Cancelled = "CANCELLED",
}

export enum Choice {
    Rock = "ROCK",
    Paper = "PAPER",
    Scissors = "SCISSORS",
};

export enum GameResult {
    WIN = "W",
    LOSS = 'L',
    WIN_AFK = 'W_AFK',
    LOSS_AFK = 'L_AFK',
    DRAW_AFK = 'D_AFK'
};

/**
 * Unions
 */

export type ClubAvailability = 'Open' | 'Invite' | 'Closed';
export type ClubRole = 'Member' | 'Founder';
export type MatchStatus = "pending" | "bye" | "completed";
export type TournamentStatus = "registration" | "in_progress" | "completed";
export type PlayerCap = 8 | 16 | 32 | 64;
export type Division = 1 | 2 | 3 | null; // null = Infinity rank

/**
 * Interfaces
 */

export interface Player {
    uid: string;
    username: string;
    rating: number;
    created: number;
    lastSeen: number;
}

export interface ProfileData {
    username: string;
    rating: number;
}

export interface Club {
    name: string;
    tag: string;
    availability: ClubAvailability;
    memberCount: number;
}

export interface UserClub extends Club {
    memberRole: ClubRole;
}

export interface ClubMember {
    uid: string;
    username: string;
    rating: number;
    role: ClubRole;
}

export interface ClubDetail extends Omit<Club, "memberCount"> {
    members: ClubMember[];
}

// Match history (Neo4j PLAYED relationship)
export interface MatchRecord {
    opponentID: string;
    opponentUsername: string;
    result: GameResult;
    playerScore: number;
    opponentScore: number;
    date: DateTime;
}

// Live game (Firebase)
export interface PlayerState {
    id: string;
    username: string;
    score: number;
    rating: number;
    choice: Choice | null;
    submitted: boolean;
}

export interface RoundData {
    player1Choice: Choice | null;
    player2Choice: Choice | null;
    winner: string | null;
}

export interface Game {
    id: string;
    state: GameState;
    player1: PlayerState;
    player2: PlayerState;
    rounds: RoundData[];
    currentRound: number;
    timestamp: number;
    winner?: string;
    endTimestamp?: number;
    roundStartTimestamp?: number;
    // Optional: only present for tournament games
    tournamentId?: string;
    matchId?: string;
}

// Tournament
export interface Participant {
    id: string;
    username: string;
    rating: number;
    registered: number;
    seed?: number;
}

export interface TournamentMatch {
    matchId: string;
    round: number;
    player1: Participant | null;
    player2: Participant | null;
    nextMatchId: string | null;
    status: MatchStatus;
    winner: Participant | null;
}

export interface Tournament {
    id: string;
    name: string;
    description: string;
    status: TournamentStatus;
    playerCap: PlayerCap;
    participants: Record<string, Participant>;
    bracket?: TournamentMatch[];
    matchGames?: Record<string, string>;
    /* unix ms */
    createdAt: number;
    /* unix ms */
    scheduledStartTime: number;
    /* unix ms */
    startTime?: number;
    /* unix ms */
    endTime?: number;
    winner?: Participant;
}

// Ranks
export type RankName = "Recruit" | "Apprentice" | "Veteran" | "Expert" | "Master" | "Grandmaster" | "Ultimate" | "Infinity";

export interface RankTier {
    rank: RankName;
    division: Division;
    minRating: number;
    color: string;
    glow: string;
}

/**
 * API Request/Response Types
 */

export type ClubMethodType = "search" | "members" | "user" | "join" | "leave" | "update";

export interface ClubsRequest {
    methodType: ClubMethodType;
    uid?: string;
    clubName?: string;
    searchTerm?: string;
    newName?: string;
    newTag?: string;
    availability?: ClubAvailability;
}

export interface DashboardStats {
    rating: number;
    totalGames: number;
    winRate: number;
    currentStreak: number;
    bestStreak: number;
}