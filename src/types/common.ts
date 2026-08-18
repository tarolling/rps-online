import type { DateTime } from "neo4j-driver";
import type { PlayMode } from "@/types";


export type PlayerMatch = {
    id: string;
    mode: PlayMode;
    opponentId: string;
    opponentUsername: string;
    result: string;
    playerScore: number;
    opponentScore: number;
    date: DateTime
};