import neo4j from "neo4j-driver";
import { NextRequest, NextResponse } from "next/server";
import { getDriver } from "@/lib/neo4j";
import { RoundData } from "@/types";
import { MatchStatus } from "@/types/neo4j";

export async function POST(req: NextRequest) {
  const {
    matchId,
    playerOneId,
    playerTwoId,
    playerOneScore,
    playerOneRating,
    playerOneNewRating,
    playerOneRocks,
    playerOnePapers,
    playerOneScissors,
    playerTwoScore,
    playerTwoRating,
    playerTwoNewRating,
    playerTwoRocks,
    playerTwoPapers,
    playerTwoScissors,
    winnerId,
    // RoundData[] from Firebase
    rounds,
  } = await req.json();

  const session = getDriver().session({ database: "neo4j" });
  try {
    await session.executeWrite((tx) => tx.run(`
        MATCH (p1:Player {uid: $playerOneId})
        MATCH (p2:Player {uid: $playerTwoId})

        CREATE (m:Match {
            id:          $matchId,
            mode:        $gameMode,
            status:      $matchStatus,
            timestamp:   datetime(),
            totalRounds: $totalRounds,
            winnerId:    $winnerId,
            p1Id:        $playerOneId
        })

        CREATE (p1)-[:PARTICIPATED_IN {
            score:        $playerOneScore,
            ratingBefore: $playerOneRating,
            ratingAfter:  $playerOneNewRating,
            rocks:        $playerOneRocks,
            papers:       $playerOnePapers,
            scissors:     $playerOneScissors,
            result:       CASE WHEN $winnerId = $playerOneId THEN 'W' ELSE 'L' END
        }]->(m)

        CREATE (p2)-[:PARTICIPATED_IN {
            score:        $playerTwoScore,
            ratingBefore: $playerTwoRating,
            ratingAfter:  $playerTwoNewRating,
            rocks:        $playerTwoRocks,
            papers:       $playerTwoPapers,
            scissors:     $playerTwoScissors,
            result:       CASE WHEN $winnerId = $playerTwoId THEN 'W' ELSE 'L' END
        }]->(m)

        WITH m
        UNWIND $rounds AS round
        CREATE (m)-[:HAD_ROUND]->(r:Round {
            roundNumber: round.roundNumber,
            p1Choice:    round.p1Choice,
            p2Choice:    round.p2Choice,
            winnerId:    round.winnerId
        })
        `, {
      matchId,
      gameMode: "ranked",
      matchStatus: MatchStatus.Completed,
      playerOneId, playerTwoId,
      playerOneScore: neo4j.int(playerOneScore),
      playerOneRating: neo4j.int(playerOneRating),
      playerOneNewRating: neo4j.int(playerOneNewRating),
      playerOneRocks: neo4j.int(playerOneRocks),
      playerOnePapers: neo4j.int(playerOnePapers),
      playerOneScissors: neo4j.int(playerOneScissors),
      playerTwoScore: neo4j.int(playerTwoScore),
      playerTwoRating: neo4j.int(playerTwoRating),
      playerTwoNewRating: neo4j.int(playerTwoNewRating),
      playerTwoRocks: neo4j.int(playerTwoRocks),
      playerTwoPapers: neo4j.int(playerTwoPapers),
      playerTwoScissors: neo4j.int(playerTwoScissors),
      winnerId,
      totalRounds: neo4j.int(rounds.length),
      rounds: rounds.map((r: RoundData, i: number) => ({
        roundNumber: i + 1,
        p1Choice: r.player1Choice,
        p2Choice: r.player2Choice,
        winnerId: r.winner,
      })),
    }));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("postGameStats error:", err);
    return NextResponse.json({ error: "Failed to record game stats." }, { status: 500 });
  } finally {
    await session.close();
  }
}