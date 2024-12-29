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
    if (req.method !== 'POST' && req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    let session;

    try {
        if (!driver) {
            return res.status(503).json({ error: 'Database connection not available' });
        }

        session = driver.session({ database: 'neo4j' });

        let response;
        if (Object.hasOwn(req.body, 'playerID')) {
            response = await session.executeRead(async tx => {
                const data = await tx.run(`
                    MATCH (:Player {uid: $playerID})-[r:PLAYED]->(p2:Player)
                    ORDER BY r.timestamp DESC
                    LIMIT 3
                    RETURN p2.uid AS uid,
                        p2.username AS username,
                        r.result AS result,
                        r.playerScore AS playerScore,
                        r.opponentScore AS opponentScore,
                        r.timestamp AS date
                `, {
                    playerID: req.body.playerID
                });

                return data.records.map((record) => ({
                    opponentID: record.get("uid"),
                    opponentUsername: record.get("username"),
                    result: record.get("result") === 'W' ? 'Win' : 'Loss',
                    playerScore: neo4j.integer.toNumber(record.get("playerScore")),
                    opponentScore: neo4j.integer.toNumber(record.get("opponentScore")),
                    date: record.get("date")
                }));
            });
        } else {
            response = await session.executeRead(async tx => {
                const data = await tx.run(`
                    MATCH (p1:Player)-[r:PLAYED]->(p2:Player)
                    WHERE p1.username < p2.username
                    ORDER BY r.timestamp DESC
                    LIMIT 3
                    RETURN p1.username AS player1,
                        p2.username AS player2,
                        r.result AS result,
                        r.playerScore AS playerScore,
                        r.opponentScore AS opponentScore,
                        r.timestamp AS timestamp
                `);

                return data.records.map((record) => {
                    const playerScore = neo4j.integer.toNumber(record.get("playerScore"));
                    const opponentScore = neo4j.integer.toNumber(record.get("opponentScore"));

                    return {
                        player1: record.get("player1"),
                        player2: record.get("player2"),
                        winner: record.get("result") === 'W' ?
                            record.get("player1") :
                            record.get("player2"),
                        score: `${playerScore}-${opponentScore}`,
                        timestamp: record.get("timestamp")
                    }
                });
            });
        }


        res.status(200).json(response);
    } catch (err) {
        console.error('Error executing query:', err);
        res.status(500).json({ error: 'Failed to record game stats.' });
    } finally {
        if (session) await session.close();
    }
}