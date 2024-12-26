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
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    let session;

    try {
        if (!driver) {
            return res.status(503).json({ error: 'Database connection not available' });
        }

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
    }
}