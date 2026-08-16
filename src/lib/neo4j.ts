import neo4j, { Driver, QueryResult } from "neo4j-driver";

let driver: Driver;

export function getDriver() {
  if (!driver) {
    driver = neo4j.driver(
        process.env.NEO4J_URI!,
        neo4j.auth.basic(process.env.NEO4J_USERNAME!, process.env.NEO4J_PASSWORD!),
    );
  }
  return driver;
}

/**
 * Runs a single Cypher statement inside its own session, handling session
 * open/close for the common one-query-per-request pattern most API routes
 * use. Errors propagate to the caller — session close still runs via
 * `finally`, but the caller decides how to log/respond. For a transaction
 * spanning multiple statements, use `getDriver().session()` directly instead.
 */
export async function runQuery(
  cypher: string,
  params: Record<string, unknown> = {},
  mode: "read" | "write" = "read",
): Promise<QueryResult> {
  const session = getDriver().session({ database: process.env.NEO4J_DATABASE });
  try {
    return mode === "write"
      ? await session.executeWrite((tx) => tx.run(cypher, params))
      : await session.executeRead((tx) => tx.run(cypher, params));
  } finally {
    await session.close();
  }
}