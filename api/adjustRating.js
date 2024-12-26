import neo4j from "neo4j-driver";

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { uid, newRating } = req.body;

    let driver, session;

    try {
        if (!process.env.NEO4J_URI || !process.env.NEO4J_USERNAME || !process.env.NEO4J_PASSWORD) {
            throw new Error('Missing required environment variables.');
        }

        driver = neo4j.driver(process.env.NEO4J_URI, neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD));
        await driver.getServerInfo();
    } catch (err) {
        console.error(`Connection error\n${err}\nCause: ${err.cause}`);
        if (driver) await driver.close();
        return res.status(503).json({ error: 'Unable to connect to Neo4j' });
    }

    try {
        session = driver.session({ database: 'neo4j' });
        await session.executeWrite(async tx => {
            return await tx.run(`
            MATCH (p:Player {uid: $uid})
            SET p.rating = $newRating
            `, {
                uid,
                newRating
            });
        });

        res.status(200);
    } catch (err) {
        console.error('Error executing query:', err);
        res.status(500).json({ error: 'Failed to validate username.' });
    } finally {
        if (session) await session.close();
        if (driver) await driver.close();
    }
}