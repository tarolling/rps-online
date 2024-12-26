import neo4j from "neo4j-driver";

let driver;
try {
    driver = neo4j.driver(
        process.env.NEO4J_URI,
        neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
    );
} catch (error) {
    console.error('Failed to create driver:', error);
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { playerID } = req.body;

    let session;

    try {
        if (!driver) {
            return res.status(503).json({ error: 'Database connection not available' });
        }

        session = driver.session({ database: 'neo4j' });
        const response = await session.executeRead(async tx => {
            const data = await tx.run(`
                MATCH (p:Player {uid: $playerID})-[r:PLAYED]->(:Player)
                WITH 
                    p, 
                    collect(r) AS games,
                    size([r IN collect(r) WHERE r.result = "W"]) AS totalWins,
                    size(collect(r)) AS totalGames
                WITH 
                    p, 
                    totalGames, 
                    totalWins,
                    toFloat(totalWins) / totalGames * 100 AS winPercentage,
                    [r IN games | {result: r.result, timestamp: r.timestamp}] AS gameData
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
                            WHEN g.result = "W" THEN 
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
                RETURN totalGames,
                    winPercentage AS winRate,
                    streakStats.current AS currentStreak,
                    streakStats.best AS bestStreak
            `, {
                playerID
            });

            return {
                totalGames: neo4j.integer.toNumber(data.records[0].get("totalGames")),
                winRate: data.records[0].get("winRate"),
                currentStreak: neo4j.integer.toNumber(data.records[0].get("currentStreak")),
                bestStreak: neo4j.integer.toNumber(data.records[0].get("bestStreak"))
            };
        });

        res.status(200).json(response);
    } catch (err) {
        console.error('Error executing query:', err);
        res.status(500).json({ error: 'Failed to record game stats.' });
    } finally {
        if (session) await session.close();
    }
}