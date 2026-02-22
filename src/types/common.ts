import { DateTime } from "neo4j-driver";


export type Match = { opponentID: string; opponentUsername: string; result: string; playerScore: number; opponentScore: number; date: DateTime };
export type ProfileData = { username: string; rating: number };