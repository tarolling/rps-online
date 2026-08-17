import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { getDriver } from "../src/lib/neo4j";

/**
 * One-time backfill: copies the legacy flat `Player.rating` / `Player.asyncRating`
 * properties into the new graph-based rating model, (:Player)-[:HAS_RATING]->(:Rating
 * {mode, value}), used going forward for all play modes (including Wildcard).
 *
 * Idempotent (MERGE/ON CREATE) and strictly additive — never touches or removes
 * the legacy `rating`/`asyncRating` properties, so it's safe to re-run and safe
 * to deploy the old code alongside it while it runs. Run this BEFORE deploying
 * any code that reads/writes via HAS_RATING/Rating, since that code falls back
 * to config.defaultRating for players with no Rating node yet.
 */
async function migrateRatingsToGraph() {
  const driver = getDriver();
  const session = driver.session({ database: process.env.NEO4J_DATABASE });

  try {
    const blitzResult = await session.executeWrite((tx) =>
      tx.run(`
        MATCH (p:Player) WHERE p.rating IS NOT NULL
        MERGE (p)-[:HAS_RATING]->(r:Rating {mode: "blitz"})
        ON CREATE SET r.value = p.rating
        RETURN count(r) AS created
      `),
    );
    console.log(`Blitz Rating nodes ensured: ${blitzResult.records[0].get("created")}`);

    const asyncResult = await session.executeWrite((tx) =>
      tx.run(`
        MATCH (p:Player) WHERE p.asyncRating IS NOT NULL
        MERGE (p)-[:HAS_RATING]->(r:Rating {mode: "async"})
        ON CREATE SET r.value = p.asyncRating
        RETURN count(r) AS created
      `),
    );
    console.log(`Async Rating nodes ensured: ${asyncResult.records[0].get("created")}`);

    // Verification: player count vs Rating node counts per mode.
    const counts = await session.executeRead((tx) =>
      tx.run(`
        MATCH (p:Player)
        WITH count(p) AS playerCount
        MATCH (:Player)-[:HAS_RATING]->(rb:Rating {mode: "blitz"})
        WITH playerCount, count(rb) AS blitzCount
        MATCH (:Player)-[:HAS_RATING]->(ra:Rating {mode: "async"})
        RETURN playerCount, blitzCount, count(ra) AS asyncCount
      `),
    );
    if (counts.records.length > 0) {
      const r = counts.records[0];
      console.log(`Players: ${r.get("playerCount")}, Blitz Rating nodes: ${r.get("blitzCount")}, Async Rating nodes: ${r.get("asyncCount")}`);
    }
  } finally {
    await session.close();
    await driver.close();
  }
}

migrateRatingsToGraph();
