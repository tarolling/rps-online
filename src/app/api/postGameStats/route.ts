import neo4j from "neo4j-driver";
import { NextRequest, NextResponse } from "next/server";
import { getDriver } from "@/lib/neo4j";

export async function POST(req: NextRequest) {
    const {
        playerID,
        opponentID,
        playerRating,
        opponentRating,
        playerScore,
        opponentScore,
        result,
        gameStats,
    } = await req.json();

    const driver = getDriver();
    const session = driver.session({ database: "neo4j" });

    try {
        await session.executeWrite((tx) =>
            tx.run(
                `
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
                `,
                {
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
                    totalRounds: neo4j.int(gameStats.totalRounds),
                }
            )
        );

        return NextResponse.json({ message: "Game stats recorded successfully." });
    } catch (err) {
        console.error("recordGame error:", err);
        return NextResponse.json({ error: "Failed to record game stats." }, { status: 500 });
    } finally {
        await session.close();
    }
}