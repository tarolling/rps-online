import neo4j from "neo4j-driver";

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { playerID } = req.body;

    let driver, session;

    try {
        if (!process.env.NEO4J_URI || !process.env.NEO4J_USERNAME || !process.env.NEO4J_PASSWORD) {
            throw new Error('Missing required environment variables.');
        }

        driver = neo4j.driver(process.env.NEO4J_URI, neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD))
        await driver.getServerInfo();
    } catch (err) {
        console.error(`Connection error\n${err}\nCause: ${err.cause}`)
        if (driver) await driver.close();
        return res.status(503).json({ error: 'Unable to connect to Neo4j' })
    }

    try {
        session = driver.session({ database: 'neo4j' });
        const response = await session.executeRead(async tx => {
            const data = await tx.run(`
                MATCH (p:Player {uid: $playerID})
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
                RETURN {
                    totalGames: totalGames,
                    winPercentage: winPercentage,
                    currentWinStreak: streakStats.current,
                    bestWinStreak: streakStats.best
                } AS result
            `, {
                playerID
            });

            console.log('data:', JSON.stringify(data));
            return data?.records[0];
        });

        res.status(200).json(response);
    } catch (err) {
        console.error('Error executing query:', err);
        res.status(500).json({ error: 'Failed to record game stats.' });
    } finally {
        if (session) await session.close();
        if (driver) await driver.close();
    }
}