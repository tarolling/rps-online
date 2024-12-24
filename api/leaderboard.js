import neo4j from "neo4j-driver";

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    let driver, session;
    try {
        if (!process.env.NEO4J_URI || !process.env.NEO4J_USERNAME || !process.env.NEO4J_PASSWORD) {
            throw new Error('Missing required environment variables.');
        }

        driver = neo4j.driver(process.env.NEO4J_URI, neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD))
        await driver.getServerInfo()
    } catch (err) {
        console.error(`Connection error\n${err}\nCause: ${err.cause}`)
        if (driver) await driver.close();
        return res.status(503).json({ error: 'Unable to connect to Neo4j' })
    }

    try {
        session = driver.session({ database: 'neo4j' })
        const leaderboard = await session.executeRead(async tx => {
            let result = await tx.run(`
            MATCH (p:Player)
            RETURN p.username AS username, p.rating AS rating
            ORDER BY p.rating DESC
            LIMIT 100
            `)

            if (!result || result.records.length === 0) {
                return [];
            }

            return result.records.map((record) => ({
                username: record.get("username"),
                rating: neo4j.integer.toNumber(record.get("rating")),
            }));
        });

        res.status(200).json({ leaderboardData: leaderboard });
    } catch (err) {
        console.error('Error executing query:', err);
        res.status(500).json({ error: 'Failed to fetch players.' });
    } finally {
        if (session) await session.close();
        if (driver) await driver.close();
    }
}