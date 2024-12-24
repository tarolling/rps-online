import neo4j from "neo4j-driver";

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const {
        player1Id,
        player2Id,
        player1Rating,
        player2Rating,
        player1Score,
        player2Score,
        winner,
        gameStats
    } = req.body;

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
        await session.executeWrite(async tx => {
            return await tx.run(`
                MATCH (p1:Player {uid: $player1Id})
                MATCH (p2:Player {uid: $player2Id})
                CREATE (p1)-[g:PLAYED]->(p2)
                SET g.timestamp = datetime(),
                    g.player1Score = $player1Score,
                    g.player2Score = $player2Score,
                    g.winner = $winner,
                    g.player1Rating = $player1Rating,
                    g.player2Rating = $player2Rating,
                    g.player1Choices = $player1Choices,
                    g.player2Choices = $player2Choices,
                    g.totalRounds = $totalRounds
                RETURN g
            `, {
                player1Id,
                player2Id,
                player1Score,
                player2Score,
                winner,
                player1Rating,
                player2Rating,
                player1Choices: gameStats.player1Choices,
                player2Choices: gameStats.player2Choices,
                totalRounds: gameStats.totalRounds
            });
        });

        res.status(200).json({ message: 'Game stats recorded successfully' });
    } catch (err) {
        console.error('Error executing query:', err);
        res.status(500).json({ error: 'Failed to record game stats.' });
    } finally {
        if (session) await session.close();
        if (driver) await driver.close();
    }
}