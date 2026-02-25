export interface Participant {
    id: string;
    username: string;
    rating: number;
    registered: number;
    seed?: number;
}

export type MatchStatus = 'pending' | 'bye' | 'completed';
export type PlayerCap = 8 | 16 | 32 | 64;

export interface Match {
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
    status: 'registration' | 'in_progress' | 'completed';
    playerCap: PlayerCap;
    participants: Record<string, Participant>;
    bracket?: Match[];
    matchGames?: Record<string, string>;
    createdAt: number; // unix ms
    startTime?: number; // unix ms
    endTime?: number; // unix ms
    winner?: Participant;
    scheduledStartTime?: number; // unix ms
}