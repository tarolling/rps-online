import neo4j from "neo4j-driver";
import { getDriver } from "@/lib/neo4j";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const viewerId = req.nextUrl.searchParams.get("viewerId");
  const targetId = req.nextUrl.searchParams.get("targetId");
  if (!viewerId) {
    return NextResponse.json({ error: "Viewer ID is required." }, { status: 400 });
  }
  if (!targetId) {
    return NextResponse.json({ error: "Target ID is required." }, { status: 400 });
  }

  const session = getDriver().session({ database: "neo4j" });
  try {
    const response = await session.executeRead(async (tx) => {
      const data = await tx.run(`
        MATCH (p:Player {uid: $viewerId})-[r:PARTICIPATED_IN]->(m:Match)<-[:PARTICIPATED_IN]-(:Player {uid: $targetId})
        RETURN 
            sum(CASE WHEN r.result = 'W' THEN 1 ELSE 0 END) AS wins,
            sum(CASE WHEN r.result = 'L' THEN 1 ELSE 0 END) AS losses
        `, {
        viewerId,
        targetId,
      });

      if (data.records.length === 0) {
        return {
          wins: 0,
          losses: 0,
        };
      }

      return {
        wins: neo4j.integer.toNumber(data.records[0].get("wins")),
        losses: neo4j.integer.toNumber(data.records[0].get("losses")),
      };
    });
    return NextResponse.json(response);
  } catch (err) {
    console.error("Error fetching head-to-head stats:", err);
    return NextResponse.json({ error: "Failed to fetch head-to-head stats." }, { status: 500 });
  } finally {
    await session.close();
  }
}