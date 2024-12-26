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
                MATCH (p:Player {uid: $playerID})-[r:PLAYED]->(p2:Player)
                ORDER BY r.timestamp DESC
                LIMIT 3
                RETURN p2.uid AS uid,
                    p2.username AS username,
                    r.result AS result,
                    r.playerScore AS playerScore,
                    r.opponentScore AS opponentScore,
                    r.timestamp AS date
            `, {
                playerID
            });

            return data.records.map((record) => ({
                opponentID: record.get("uid"),
                opponentUsername: record.get("username"),
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
    }
}