import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/neo4j";
import { getAuthedUid } from "@/lib/auth";
import { withErrorHandling } from "@/lib/apiHandler";
import { getTitle } from "@/lib/titles";

/**
 * Sets (or clears, with titleId: null) the caller's equipped title. Always
 * acts on the authenticated caller's own uid — never a client-supplied one —
 * and only allows equipping a title the player has actually earned.
 */
export const POST = withErrorHandling("titles/equip", async (req: NextRequest) => {
  const authedUid = await getAuthedUid(req);
  if (!authedUid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { titleId } = await req.json();
  if (titleId !== null && (typeof titleId !== "string" || !getTitle(titleId))) {
    return NextResponse.json({ error: "Invalid title." }, { status: 400 });
  }

  if (titleId === null) {
    await runQuery(
      "MATCH (p:Player {uid: $uid}) SET p.equippedTitleId = null",
      { uid: authedUid },
      "write",
    );
    return NextResponse.json({ success: true });
  }

  const result = await runQuery(`
    MATCH (p:Player {uid: $uid})-[:EARNED_TITLE]->(t:Title {id: $titleId})
    SET p.equippedTitleId = $titleId
    RETURN p.uid AS uid
    `, { uid: authedUid, titleId }, "write");

  if (result.records.length === 0) {
    return NextResponse.json({ error: "You have not earned this title." }, { status: 403 });
  }

  return NextResponse.json({ success: true });
});
