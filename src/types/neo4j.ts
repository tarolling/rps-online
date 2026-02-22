// these are supposed to align with the nodes stored in neo4j

import { DateTime } from "neo4j-driver";

////////////////////////////////////////////////////////////////
// Nodes
////////////////////////////////////////////////////////////////

export type Player = {
    created: number;
    lastSeen: number;
    rating: number;
    uid: string;
    username: string;
};

export type Club = {
    availability: "Open" | "Invite" | "Closed";
    name: string;
    tag: string;
};

////////////////////////////////////////////////////////////////
// Relationships
////////////////////////////////////////////////////////////////

export type Member = {
    role: "Member" | "Founder";
};

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