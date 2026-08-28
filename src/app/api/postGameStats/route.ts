import neo4j from "neo4j-driver";
import { NextRequest, NextResponse } from "next/server";
import { getDriver } from "@/lib/neo4j";
import { adminDb } from "@/lib/firebaseAdmin";
import { getAuthedUid } from "@/lib/auth";
import { withErrorHandling } from "@/lib/apiHandler";
import { calculateGameStats } from "@/lib/gameLogic";
import calculateRating from "@/lib/calculateRating";
import { GAME_MODES, isValidPlayMode } from "@/lib/gameModes";
import { checkAndAwardMatchTitles } from "@/lib/titles.server";
import { MatchStatus } from "@/types/neo4j";
import type { Game, RoundData } from "@/types";

/**
 * Records a completed game's Match/Round/PARTICIPATED_IN nodes and adjusts
 * both players' ratings. Deliberately trusts nothing from the request body
 * except `matchId` (which doubles as the game's Firebase key) — every score,
 * choice tally, and rating change is recomputed here from the Firebase game
 * record, since a client posting arbitrary numbers here could otherwise
 * forge match history or inflate/tank any player's rating at will.
 */
export const POST = withErrorHandling("postGameStats", async (req: NextRequest) => {
  const { matchId } = await req.json();
  if (!matchId) {
    return NextResponse.json({ error: "Match ID is required." }, { status: 400 });
  }

  const snap = await adminDb.ref(`games/${matchId}`).get();
  const game: Game | null = snap.val();
  if (!game) {
    return NextResponse.json({ error: "Game not found." }, { status: 404 });
  }
  if (game.state !== MatchStatus.Completed || !game.winner) {
    return NextResponse.json({ error: "Game is not in a completed, recordable state." }, { status: 400 });
  }
  if (game.winner !== game.player1.id && game.winner !== game.player2.id) {
    return NextResponse.json({ error: "Invalid winner." }, { status: 400 });
  }

  // Server-to-server calls (the async mode's matchmakingServer.ts, which has
  // no browser session to authenticate with) present a shared secret instead
  // — same pattern as this app's CRON_SECRET-guarded cron routes. Otherwise
  // the caller must be authenticated as one of the two players in the game.
  const internalSecret = process.env.INTERNAL_API_SECRET;
  const isInternalCall = !!internalSecret && req.headers.get("x-internal-secret") === internalSecret;
  if (!isInternalCall) {
    const authedUid = await getAuthedUid(req);
    if (!authedUid || (authedUid !== game.player1.id && authedUid !== game.player2.id)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const mode = isValidPlayMode(game.mode) ? game.mode : "blitz";
  const gameMode = GAME_MODES[mode].matchMode;

  const session = getDriver().session({ database: process.env.NEO4J_DATABASE });
  try {
    // Idempotency: a retried/duplicate call for a game that's already been
    // recorded should no-op rather than create a second Match node.
    const existing = await session.executeRead((tx) =>
      tx.run("MATCH (m:Match {id: $matchId}) RETURN m LIMIT 1", { matchId }),
    );
    if (existing.records.length > 0) {
      return NextResponse.json({ success: true, alreadyRecorded: true });
    }

    const { player1, player2 } = game;
    const gameStats = calculateGameStats(game);
    const playerOneNewRating = calculateRating(player1.rating, player2.rating, game.winner === player1.id);
    const playerTwoNewRating = calculateRating(player2.rating, player1.rating, game.winner === player2.id);
    const rounds = Object.values(game.rounds ?? {}).filter((r) => r.player1Choice !== null && r.player2Choice !== null);

    await session.executeWrite(async (tx) => {
      await tx.run(`
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
        mode,
        gameMode,
        matchStatus: MatchStatus.Completed,
        playerOneId: player1.id, playerTwoId: player2.id,
        playerOneScore: neo4j.int(player1.score),
        playerOneRating: neo4j.int(player1.rating),
        playerOneNewRating: neo4j.int(playerOneNewRating),
        playerOneRocks: neo4j.int(gameStats.playerOneChoices.ROCK),
        playerOnePapers: neo4j.int(gameStats.playerOneChoices.PAPER),
        playerOneScissors: neo4j.int(gameStats.playerOneChoices.SCISSORS),
        playerTwoScore: neo4j.int(player2.score),
        playerTwoRating: neo4j.int(player2.rating),
        playerTwoNewRating: neo4j.int(playerTwoNewRating),
        playerTwoRocks: neo4j.int(gameStats.playerTwoChoices.ROCK),
        playerTwoPapers: neo4j.int(gameStats.playerTwoChoices.PAPER),
        playerTwoScissors: neo4j.int(gameStats.playerTwoChoices.SCISSORS),
        winnerId: game.winner,
        totalRounds: neo4j.int(rounds.length),
        rounds: rounds.map((r: RoundData, i: number) => ({
          roundNumber: i + 1,
          p1Choice: r.player1Choice,
          p2Choice: r.player2Choice,
          winnerId: r.winner,
        })),
      });

      await tx.run(`
        MATCH (p1:Player {uid: $playerOneId})
        MERGE (p1)-[:HAS_RATING]->(r1:Rating {mode: $mode})
        SET r1.value = $playerOneNewRating
        WITH 1 AS _
        MATCH (p2:Player {uid: $playerTwoId})
        MERGE (p2)-[:HAS_RATING]->(r2:Rating {mode: $mode})
        SET r2.value = $playerTwoNewRating
        `, {
        playerOneId: player1.id,
        playerTwoId: player2.id,
        mode,
        playerOneNewRating: neo4j.int(playerOneNewRating),
        playerTwoNewRating: neo4j.int(playerTwoNewRating),
      });
    });

    await Promise.all([
      checkAndAwardMatchTitles(player1.id, playerOneNewRating),
      checkAndAwardMatchTitles(player2.id, playerTwoNewRating),
    ]);

    return NextResponse.json({ success: true });
  } finally {
    await session.close();
  }
});
