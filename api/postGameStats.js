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

    const {
        playerID,
        opponentID,
        playerRating,
        opponentRating,
        playerScore,
        opponentScore,
        result,
        gameStats
    } = req.body;

    let session;

    try {
        if (!driver) {
            return res.status(503).json({ error: 'Database connection not available' });
        }

        session = driver.session({ database: 'neo4j' });
        await session.executeWrite(async tx => {
            return await tx.run(`
                MATCH (p1:Player {uid: $playerID})
                MATCH (p2:Player {uid: $opponentID})
                CREATE (p1)-[g:PLAYED]->(p2)
                SET g.timestamp = datetime(),
                    g.playerScore = $playerScore,
                    g.opponentScore = $opponentScore,
                    g.result = $result,
                    g.playerRating = $playerRating,
                    g.opponentRating = $opponentRating,
                    g.playerRocks = $playerRocks,
                    g.playerPapers = $playerPapers,
                    g.playerScissors = $playerScissors,
                    g.opponentRocks = $opponentRocks,
                    g.opponentPapers = $opponentPapers,
                    g.opponentScissors = $opponentScissors,
                    g.totalRounds = $totalRounds
                RETURN g
            `, {
                playerID,
                opponentID,
                playerScore: neo4j.int(playerScore),
                opponentScore: neo4j.int(opponentScore),
                result,
                playerRating,
                opponentRating,
                playerRocks: neo4j.int(gameStats.playerChoices.ROCK),
                playerPapers: neo4j.int(gameStats.playerChoices.PAPER),
                playerScissors: neo4j.int(gameStats.playerChoices.SCISSORS),
                opponentRocks: neo4j.int(gameStats.opponentChoices.ROCK),
                opponentPapers: neo4j.int(gameStats.opponentChoices.PAPER),
                opponentScissors: neo4j.int(gameStats.opponentChoices.SCISSORS),
                totalRounds: neo4j.int(gameStats.totalRounds)
            });
        });

        res.status(200).json({ message: 'Game stats recorded successfully' });
    } catch (err) {
        console.error('Error executing query:', err);
        res.status(500).json({ error: 'Failed to record game stats.' });
    } finally {
        if (session) await session.close();
    }
}