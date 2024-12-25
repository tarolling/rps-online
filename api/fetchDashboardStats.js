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
                MATCH (p:Player {uid: $playerId})
                MATCH (p)-[games:PLAYED]-()
                WITH p,
                    COUNT(games) as totalGames,
                    toFloat(COUNT(CASE WHEN games.result = 'W' THEN 1 END)) as wins,
                    COLLECT(CASE WHEN games.timestamp IS NOT NULL 
                            THEN {result: games.result, timestamp: games.timestamp} 
                            END) as gameResults

                WITH p, totalGames, wins,
                    [x IN gameResults WHERE x IS NOT NULL | x.result] as results,
                    REDUCE(streak = 0, result in REVERSE(results) |
                        CASE result
                            WHEN 'W' THEN streak + 1
                            ELSE 0
                        END
                    ) as currentStreak,
                    REDUCE(
                        acc = {streak: 0, best: 0}, result in results |
                        CASE result
                            WHEN 'W' THEN {
                                streak: acc.streak + 1,
                                best: CASE 
                                    WHEN acc.streak + 1 > acc.best 
                                    THEN acc.streak + 1 
                                    ELSE acc.best 
                                    END
                            }
                            ELSE {streak: 0, best: acc.best}
                        END
                    ).best as bestStreak

                RETURN 
                    p.uid as playerID,
                    totalGames,
                    ROUND(100.0 * wins / totalGames, 2) as winRate,
                    currentStreak,
                    bestStreak;
            `, {
                playerID
            });

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