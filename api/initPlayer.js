import neo4j from "neo4j-driver";
import config from '../src/config/settings.json';

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
    const username = req.body.username ?? "random";

    let session;

    try {
        if (!driver) {
            return res.status(503).json({ error: 'Database connection not available' });
        }

        session = driver.session({ database: 'neo4j' })
        const write = await session.executeWrite(async tx => {
            let result = await tx.run(`
            MERGE (p:Player {uid: $uid})
            ON CREATE
                SET p.username = $username,
                    p.rating = $defaultRating,
                    p.created = timestamp(),
                    p.lastSeen = timestamp()
            ON MATCH
                SET p.lastSeen = timestamp()
            RETURN p.username AS username
            `, { uid, username, defaultRating: config.defaultRating });

            if (!result || result.records.length === 0) {
                throw new Error('Unable to modify player.');
            }
            return result.records[0].get('username');
        });

        res.status(200).json({ username: write });
    } catch (err) {
        console.error('Error executing query:', err);
        res.status(500).json({ error: 'Failed to process player.' });
    } finally {
        if (session) await session.close();
    }
}