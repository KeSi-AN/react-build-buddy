import neo4j, { type Driver, type Session } from "neo4j-driver";

/**
 * Connection details are read from environment variables only.
 * Never commit credentials to the repository.
 *
 *   NEO4J_URI       e.g. bolt+s://<instance-id>-databases.cognodb.cloud
 *   NEO4J_USERNAME  e.g. cognodb
 *   NEO4J_PASSWORD  generated on instance creation
 *   NEO4J_DATABASE  optional, defaults to "neo4j"
 */
export type GraphConfig = {
  uri: string;
  username: string;
  password: string;
  database: string;
};

export class GraphUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphUnavailableError";
  }
}

export function readConfig(): GraphConfig | null {
  const uri = process.env["NEO4J_URI"];
  const username = process.env["NEO4J_USERNAME"];
  const password = process.env["NEO4J_PASSWORD"];
  if (!uri || !username || !password) return null;
  return { uri, username, password, database: process.env["NEO4J_DATABASE"] ?? "neo4j" };
}

let cached: { driver: Driver; key: string } | null = null;

function getDriver(config: GraphConfig): Driver {
  const key = `${config.uri}|${config.username}`;
  if (cached && cached.key === key) return cached.driver;
  const driver = neo4j.driver(config.uri, neo4j.auth.basic(config.username, config.password), {
    maxConnectionPoolSize: 8,
    connectionAcquisitionTimeout: 15_000,
  });
  cached = { driver, key };
  return driver;
}

/** Convert Neo4j runtime values (Integer, Node, Relationship, Path) to plain JSON. */
export function toPlain(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (neo4j.isInt(value)) return (value as { toNumber: () => number }).toNumber();
  if (Array.isArray(value)) return value.map(toPlain);
  if (typeof value === "object") {
    const v = value as Record<string, unknown> & { labels?: string[]; type?: string };
    if ("labels" in v && "properties" in v) {
      return {
        _kind: "node",
        id: String((v as { elementId: string }).elementId),
        labels: v.labels,
        properties: toPlain(v["properties"]),
      };
    }
    if ("type" in v && "properties" in v && "start" in v) {
      return {
        _kind: "relationship",
        id: String((v as { elementId: string }).elementId),
        type: v.type,
        start: String((v as { startNodeElementId: string }).startNodeElementId),
        end: String((v as { endNodeElementId: string }).endNodeElementId),
        properties: toPlain(v["properties"]),
      };
    }
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) out[k] = toPlain(val);
    return out;
  }
  return value;
}

/**
 * Run a parameterised Cypher statement. Parameters are always passed through
 * the driver — statements are never built by string concatenation.
 */
export async function runCypher<T = Record<string, unknown>>(
  cypher: string,
  params: Record<string, unknown> = {},
  mode: "read" | "write" = "read",
): Promise<T[]> {
  const config = readConfig();
  if (!config) {
    throw new GraphUnavailableError(
      "Graph database is not configured. Set NEO4J_URI, NEO4J_USERNAME and NEO4J_PASSWORD.",
    );
  }

  let session: Session | null = null;
  try {
    session = getDriver(config).session({
      database: config.database,
      defaultAccessMode: mode === "write" ? neo4j.session.WRITE : neo4j.session.READ,
    });
    const result = await session.run(cypher, params);
    return result.records.map((record) => toPlain(record.toObject()) as T);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[graph] cypher failed", { cypher, message });
    throw new GraphUnavailableError(
      /auth|unauthor|credential/i.test(message)
        ? "The graph database rejected the credentials. Check NEO4J_USERNAME and NEO4J_PASSWORD."
        : "Could not reach the graph database. It may be paused, unreachable, or still starting.",
    );
  } finally {
    await session?.close();
  }
}
