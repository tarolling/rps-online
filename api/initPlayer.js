import neo4j from "neo4j-driver";

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { uid } = req.body;
    const username = req.body.username ?? "random";

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
        return res.status(503).json({ error: 'Unable to connect to Neo4j' });
    }

    try {
        session = driver.session({ database: 'neo4j' })
        const write = await session.executeWrite(async tx => {
            let result = await tx.run(`
            MERGE (p:Player {uid: $uid})
            ON CREATE
                SET p.username = $username,
                    p.rating = 500,
                    p.created = timestamp(),
                    p.lastSeen = timestamp()
            ON MATCH
                SET p.lastSeen = timestamp()
            RETURN p.username AS username
            `, { uid: uid, username: username }
            );

            if (!result || result.records.length === 0) {
                throw new Error('Unable to modify player.');
            }
            return result.records[0].get('username');
        });

        console.log(`User ${write} added/updated!`);
        res.status(200).json({ username: write });
    } catch (err) {
        console.error('Error executing query:', err);
        res.status(500).json({ error: 'Failed to process player.' });
    } finally {
        if (session) await session.close();
        if (driver) await driver.close();
    }
}