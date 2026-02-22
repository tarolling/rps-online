import neo4j from "neo4j-driver";
import { NextRequest, NextResponse } from "next/server";
import { getDriver } from "@/lib/neo4j";

export async function POST(req: NextRequest) {
    const {
        playerOneId,
        playerTwoId,
        playerOneScore,
        playerOneRating,
        playerOneRocks,
        playerOnePapers,
        playerOneScissors,
        playerTwoScore,
        playerTwoRating,
        playerTwoRocks,
        playerTwoPapers,
        playerTwoScissors,
        winnerId,
        totalRounds,
    } = await req.json();

    const driver = getDriver();
    const session = driver.session({ database: "neo4j" });

    try {
        await session.executeWrite((tx) =>
            tx.run(
                `
                MATCH (p1:Player {uid: $playerOneId})
                MATCH (p2:Player {uid: $playerTwoId})
                CREATE (p1)-[g:PLAYED]->(p2)
                SET g.timestamp = datetime(),
                    g.playerOneScore = $playerOneScore,
                    g.playerOneRating = $playerOneRating,
                    g.playerOneRocks = $playerOneRocks,
                    g.playerOnePapers = $playerOnePapers,
                    g.playerOneScissors = $playerOneScissors,
                    g.playerTwoScore = $playerTwoScore,
                    g.playerTwoRating = $playerTwoRating,
                    g.playerTwoRocks = $playerTwoRocks,
                    g.playerTwoPapers = $playerTwoPapers,
                    g.playerTwoScissors = $playerTwoScissors,
                    g.winnerId = $winnerId,
                    g.totalRounds = $totalRounds
                RETURN g
                `,
                {
                    playerOneId,
                    playerTwoId,
                    playerOneScore: neo4j.int(playerOneScore),
                    playerOneRating: neo4j.int(playerOneRating),
                    playerOneRocks: neo4j.int(playerOneRocks),
                    playerOnePapers: neo4j.int(playerOnePapers),
                    playerOneScissors: neo4j.int(playerOneScissors),
                    playerTwoScore: neo4j.int(playerTwoScore),
                    playerTwoRating: neo4j.int(playerTwoRating),
                    playerTwoRocks: neo4j.int(playerTwoRocks),
                    playerTwoPapers: neo4j.int(playerTwoPapers),
                    playerTwoScissors: neo4j.int(playerTwoScissors),
                    winnerId,
                    totalRounds: neo4j.int(totalRounds),
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