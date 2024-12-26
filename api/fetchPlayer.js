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

    const { uid } = req.body;

    let session;

    try {
        if (!driver) {
            return res.status(503).json({ error: 'Database connection not available' });
        }

        session = driver.session({ database: 'neo4j' });
        const read = await session.executeRead(async tx => {
            let result = await tx.run(`
            MATCH (p:Player {uid: $uid})
            RETURN p.username AS username, p.rating AS rating
            `, { uid: uid });

            if (result?.records.length === 0) {
                throw new Error("No players with the specified user ID exists.");
            }

            return result.records[0];
        });

        res.status(200).json({
            username: read.get("username"),
            rating: neo4j.integer.toNumber(read.get("rating"))
        });
    } catch (err) {
        console.error('Error executing query:', err);
        res.status(500).json({ error: 'Failed to fetch player info.' });
    } finally {
        if (session) await session.close();
    }
}