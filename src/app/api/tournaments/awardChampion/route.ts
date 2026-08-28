import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getAuthedUid } from "@/lib/auth";
import { withErrorHandling } from "@/lib/apiHandler";
import { awardTournamentChampionTitle } from "@/lib/titles.server";
import { TournamentStatus } from "@/types/neo4j";
import type { Tournament } from "@/types";

/**
 * Awards the Tournament Champion title once a tournament has finished.
 * Re-reads the tournament from Firebase rather than trusting a client-supplied
 * winner id — the caller only needs to be an authenticated player, since
 * awarding is idempotent (MERGE) and driven entirely by the canonical
 * tournament record.
 */
export const POST = withErrorHandling("tournaments/awardChampion", async (req: NextRequest) => {
  const authedUid = await getAuthedUid(req);
  if (!authedUid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tournamentId } = await req.json();
  if (!tournamentId) {
    return NextResponse.json({ error: "Tournament ID is required." }, { status: 400 });
  }

  const snap = await adminDb.ref(`tournaments/${tournamentId}`).get();
  const tournament: Tournament | null = snap.val();
  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  }
  if (tournament.status !== TournamentStatus.Completed || !tournament.winner) {
    return NextResponse.json({ error: "Tournament is not completed." }, { status: 400 });
  }

  await awardTournamentChampionTitle(tournament.winner.id);

  return NextResponse.json({ success: true });
});
