import neo4j from "neo4j-driver";
import { runQuery } from "@/lib/neo4j";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const viewerId = req.nextUrl.searchParams.get("viewerId");
  const targetId = req.nextUrl.searchParams.get("targetId");
  const mode = req.nextUrl.searchParams.get("mode"); // "blitz" | "async" | omitted (combined, lifetime)
  if (!viewerId) {
    return NextResponse.json({ error: "Viewer ID is required." }, { status: 400 });
  }
  if (!targetId) {
    return NextResponse.json({ error: "Target ID is required." }, { status: 400 });
  }
  if (mode !== null && mode !== "blitz" && mode !== "async") {
    return NextResponse.json({ error: "Invalid mode." }, { status: 400 });
  }
  const matchMode = mode === "async" ? "ranked_async" : mode === "blitz" ? "ranked" : null;

  try {
    const data = await runQuery(`
      MATCH (p:Player {uid: $viewerId})-[r:PARTICIPATED_IN]->(m:Match)<-[:PARTICIPATED_IN]-(:Player {uid: $targetId})
      WHERE $matchMode IS NULL OR m.mode = $matchMode
      RETURN
          sum(CASE WHEN r.result = 'W' THEN 1 ELSE 0 END) AS wins,
          sum(CASE WHEN r.result = 'L' THEN 1 ELSE 0 END) AS losses
      `, {
      viewerId,
      targetId,
      matchMode,
    });

    const response = data.records.length === 0
      ? { wins: 0, losses: 0 }
      : {
        wins: neo4j.integer.toNumber(data.records[0].get("wins")),
        losses: neo4j.integer.toNumber(data.records[0].get("losses")),
      };
    return NextResponse.json(response);
  } catch (err) {
    console.error("Error fetching head-to-head stats:", err);
    return NextResponse.json({ error: "Failed to fetch head-to-head stats." }, { status: 500 });
  }
}