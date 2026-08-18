import { GraphUnavailableError, runCypher } from "./neo4j.server";

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function guard<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof GraphUnavailableError) return { ok: false, error: error.message };
    console.error("[graph] unexpected failure", error);
    return { ok: false, error: "Unexpected error while querying the graph." };
  }
}

export type Overview = {
  labels: { label: string; count: number }[];
  relationships: { type: string; count: number }[];
  totals: { nodes: number; relationships: number };
};

export async function fetchOverview(): Promise<Overview> {
  const labels = await runCypher<{ label: string; count: number }>(
    `MATCH (n)
     UNWIND labels(n) AS label
     RETURN label, count(*) AS count
     ORDER BY count DESC`,
  );
  const relationships = await runCypher<{ type: string; count: number }>(
    `MATCH ()-[r]->()
     RETURN type(r) AS type, count(*) AS count
     ORDER BY count DESC`,
  );
  return {
    labels,
    relationships,
    totals: {
      nodes: labels.reduce((a, b) => a + b.count, 0),
      relationships: relationships.reduce((a, b) => a + b.count, 0),
    },
  };
}

export type GraphNode = { id: string; label: string; name: string; group: string };
export type GraphEdge = { source: string; target: string; type: string };
export type GraphPayload = { nodes: GraphNode[]; edges: GraphEdge[] };

const NETWORK_CYPHER = `
MATCH (n)-[r]->(m)
WHERE $region IS NULL
   OR EXISTS { MATCH (n)-[:LOCATED_IN]->(:Region {name: $region}) }
   OR EXISTS { MATCH (m)-[:LOCATED_IN]->(:Region {name: $region}) }
RETURN elementId(n) AS sourceId, head(labels(n)) AS sourceLabel, coalesce(n.name, n.id) AS sourceName,
       elementId(m) AS targetId, head(labels(m)) AS targetLabel, coalesce(m.name, m.id) AS targetName,
       type(r) AS relType
LIMIT $limit`;

type NetworkRow = {
  sourceId: string;
  sourceLabel: string;
  sourceName: string;
  targetId: string;
  targetLabel: string;
  targetName: string;
  relType: string;
};

export async function fetchNetwork(region: string | null, limit: number): Promise<GraphPayload> {
  const rows = await runCypher<NetworkRow>(NETWORK_CYPHER, { region, limit });
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  for (const row of rows) {
    nodes.set(row.sourceId, {
      id: row.sourceId,
      label: row.sourceLabel,
      name: row.sourceName,
      group: row.sourceLabel,
    });
    nodes.set(row.targetId, {
      id: row.targetId,
      label: row.targetLabel,
      name: row.targetName,
      group: row.targetLabel,
    });
    edges.push({ source: row.sourceId, target: row.targetId, type: row.relType });
  }
  return { nodes: [...nodes.values()], edges };
}

export type SupplierRow = { id: string; name: string; tier: number; region: string; reliability: number };

export async function fetchSuppliers(): Promise<SupplierRow[]> {
  return runCypher<SupplierRow>(
    `MATCH (s:Supplier)
     OPTIONAL MATCH (s)-[:LOCATED_IN]->(reg:Region)
     RETURN s.id AS id, s.name AS name, s.tier AS tier,
            coalesce(reg.name, 'Unknown') AS region,
            s.reliability AS reliability
     ORDER BY s.tier, s.name`,
  );
}

export type ImpactRow = {
  product: string;
  productLine: string;
  hops: number;
  path: string[];
  factories: string[];
};

/**
 * Multi-hop traversal: a supplier's parts, through sub-assemblies, up to finished products.
 * Cypher cannot parameterise a variable-length upper bound, so the value is clamped
 * to a small integer range before it is placed in the pattern.
 */
export async function fetchImpact(supplierId: string, maxHops: number): Promise<ImpactRow[]> {
  const hops = Math.min(6, Math.max(1, Math.trunc(maxHops) || 1));
  return runCypher<ImpactRow>(
    `MATCH (s:Supplier {id: $supplierId})-[:SUPPLIES]->(p:Part)
     MATCH path = (p)-[:PART_OF*1..${hops}]->(prod:Product)
     OPTIONAL MATCH (f:Factory)-[:ASSEMBLES]->(prod)
     RETURN prod.name AS product,
            prod.line AS productLine,
            length(path) AS hops,
            [n IN nodes(path) | coalesce(n.name, n.id)] AS path,
            collect(DISTINCT coalesce(f.name, 'Unassigned')) AS factories
     ORDER BY hops, product`,
    { supplierId, maxHops: hops },
  );
}

export type SingleSourceRow = { part: string; supplier: string; region: string; leadTimeDays: number };

export async function fetchSingleSourceRisk(): Promise<SingleSourceRow[]> {
  return runCypher<SingleSourceRow>(
    `MATCH (p:Part)<-[sup:SUPPLIES]-(s:Supplier)
     WITH p, collect(s) AS suppliers, collect(sup) AS rels
     WHERE size(suppliers) = 1
     WITH p, suppliers[0] AS s, rels[0] AS sup
     OPTIONAL MATCH (s)-[:LOCATED_IN]->(reg:Region)
     RETURN p.name AS part, s.name AS supplier,
            coalesce(reg.name, 'Unknown') AS region,
            sup.leadTimeDays AS leadTimeDays
     ORDER BY leadTimeDays DESC`,
  );
}

export type RegionRiskRow = {
  region: string;
  riskLevel: string;
  events: string[];
  exposedProducts: number;
};

export async function fetchRegionRisk(): Promise<RegionRiskRow[]> {
  return runCypher<RegionRiskRow>(
    `MATCH (reg:Region)
     OPTIONAL MATCH (e:RiskEvent)-[:AFFECTS]->(reg)
     OPTIONAL MATCH (reg)<-[:LOCATED_IN]-(:Supplier)-[:SUPPLIES]->(:Part)-[:PART_OF*1..4]->(prod:Product)
     RETURN reg.name AS region,
            reg.riskLevel AS riskLevel,
            collect(DISTINCT coalesce(e.type, null)) AS events,
            count(DISTINCT prod) AS exposedProducts
     ORDER BY exposedProducts DESC`,
  );
}

export type ShipmentRow = {
  id: string;
  status: string;
  eta: string;
  part: string;
  from: string;
  to: string;
};

export async function fetchShipments(status: string | null): Promise<ShipmentRow[]> {
  return runCypher<ShipmentRow>(
    `MATCH (sh:Shipment)-[:CARRIES]->(p:Part)
     MATCH (sh)-[:FROM]->(s:Supplier)
     MATCH (sh)-[:TO]->(f:Factory)
     WHERE $status IS NULL OR sh.status = $status
     RETURN sh.id AS id, sh.status AS status, sh.eta AS eta,
            p.name AS part, s.name AS from, f.name AS to
     ORDER BY sh.eta`,
    { status },
  );
}

export type PathRow = { nodes: string[]; rels: string[]; hops: number };

export async function fetchShortestPath(fromId: string, toId: string): Promise<PathRow[]> {
  return runCypher<PathRow>(
    `MATCH (a {id: $fromId}), (b {id: $toId})
     MATCH path = shortestPath((a)-[*..8]-(b))
     RETURN [n IN nodes(path) | coalesce(n.name, n.id)] AS nodes,
            [r IN relationships(path) | type(r)] AS rels,
            length(path) AS hops`,
    { fromId, toId },
  );
}
