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
                MATCH (p:Player {uid: $playerID})-[r:PLAYED]->(p2:Player)
                ORDER BY r.timestamp DESC
                LIMIT 3
                RETURN p2.username AS username,
                    r.result AS result,
                    r.playerScore AS playerScore,
                    r.opponentScore AS opponentScore,
                    r.timestamp AS date
            `, {
                playerID
            });

            return data.records.map((record) => ({
                opponent: record.get("username"),
                result: record.get("result") === 'W' ? 'Win' : 'Loss',
                playerScore: neo4j.integer.toNumber(record.get("playerScore")),
                opponentScore: neo4j.integer.toNumber(record.get("opponentScore")),
                date: `${record.get("date").year}-${record.get("date").month}-${record.get("date").day}`
            }));
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