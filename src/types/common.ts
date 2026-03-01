import { DateTime } from "neo4j-driver";


export type PlayerMatch = { 
    id: string;
    opponentId: string; 
    opponentUsername: string; 
    result: string; 
    playerScore: number; 
    opponentScore: number; 
    date: DateTime
};