import { NextRequest, NextResponse } from "next/server";
import neo4j from 'neo4j-driver';
import { getDriver } from "@/lib/neo4j";
import config from "@/config/settings.json";

export async function POST(req: NextRequest) {
    const { playerId } = await req.json();

    if (!playerId) {
        return NextResponse.json({ error: "Player ID is required." }, { status: 400 });
    }

    const driver = getDriver();
    const session = driver.session({ database: "neo4j" });

    try {
        const response = await session.executeRead(async tx => {
            const data = await tx.run(`
                MATCH (p:Player {uid: $playerId})-[r:PLAYED]-(:Player)
                WITH 
                    p, 
                    collect(r) AS games,
                    size([r IN collect(r) WHERE r.winnerId = $playerId]) AS totalWins,
                    size(collect(r)) AS totalGames
                WITH 
                    p, 
                    totalGames, 
                    totalWins,
                    toFloat(totalWins) / totalGames * 100 AS winPercentage,
                    [r IN games | {winnerId: r.winnerId, timestamp: r.timestamp}] AS gameData
                WITH 
                    p, 
                    totalGames, 
                    winPercentage,
                    apoc.coll.sortMaps(gameData, "timestamp") AS sortedAscending,
                    reverse(apoc.coll.sortMaps(gameData, "timestamp")) AS sortedByTimeDesc
                WITH 
                    p, 
                    totalGames, 
                    winPercentage, 
                    reduce(streaks = {current: 0, best: 0}, g IN sortedByTimeDesc | 
                        CASE 
                            WHEN g.winnerId = $playerId THEN 
                                {
                                    current: streaks.current + 1, 
                                    best: CASE WHEN streaks.current + 1 > streaks.best THEN streaks.current + 1 ELSE streaks.best END
                                }
                            ELSE 
                                {
                                    current: 0, 
                                    best: streaks.best
                                }
                        END
                    ) AS streakStats
                RETURN p.rating AS rating,
                    totalGames,
                    winPercentage AS winRate,
                    streakStats.current AS currentStreak,
                    streakStats.best AS bestStreak
            `, {
                playerId
            });

            if (data.records.length === 0) {
                return {
                    rating: config.defaultRating,
                    totalGames: 0,
                    winRate: 0,
                    currentStreak: 0,
                    bestStreak: 0
                }
            }

            return {
                rating: neo4j.integer.toNumber(data.records[0].get("rating")),
                totalGames: neo4j.integer.toNumber(data.records[0].get("totalGames")),
                winRate: neo4j.integer.toNumber(data.records[0].get("winRate")),
                currentStreak: neo4j.integer.toNumber(data.records[0].get("currentStreak")),
                bestStreak: neo4j.integer.toNumber(data.records[0].get("bestStreak"))
            };
        });

        return NextResponse.json(response);
    } catch (err) {
        console.error('fetchDashboardStats error:', err);
        return NextResponse.json({ error: 'Failed to record game stats.' }, { status: 500 });
    } finally {
        await session.close();
    }
}