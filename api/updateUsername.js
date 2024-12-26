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

    const { uid, newUsername } = req.body;

    let session;

    try {
        if (!driver) {
            return res.status(503).json({ error: 'Database connection not available' });
        }

        session = driver.session({ database: 'neo4j' });
        await session.executeWrite(async tx => {
            await tx.run(`
            MATCH (p:Player {uid: $uid})
            SET p.username = $newUsername
            `, { uid, newUsername });
        });

        res.status(200).json({ success: true });
    } catch (err) {
        console.error('Error executing query:', err);
        res.status(500).json({ error: 'Failed to update username.' });
    } finally {
        if (session) await session.close();
    }
}