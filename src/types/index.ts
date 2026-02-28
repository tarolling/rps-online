/**
 * Enums
 */

import { DateTime } from "neo4j-driver";
import { Choice, ClubAvailability, ClubRole, Division, Match, MatchStatus, ParticipatedIn, Round, TournamentPlayerCap, TournamentStatus, type TournamentMatchStatus } from "./neo4j";


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
    matchId: string;
    opponentID: string;
    opponentUsername: string;
    result: ParticipatedIn["result"];   // reuse, don't redefine
    playerScore: number;
    opponentScore: number;
    mode: Match["mode"];                // free — you get this for no extra work
    date: DateTime;
    rounds?: Round[];                   // optional detail view
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
    /* ID of the winner of this round */
    winner: string | null;
}

export interface Game {
    id: string;
    state: MatchStatus;
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
    status: TournamentMatchStatus;
    winner: Participant | null;
}

export interface Tournament {
    id: string;
    name: string;
    description: string;
    status: TournamentStatus;
    playerCap: TournamentPlayerCap;
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