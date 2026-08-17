import { createFileRoute } from "@tanstack/react-router";
import { Panel } from "@/components/DataState";

export const Route = createFileRoute("/model")({
  head: () => ({
    meta: [
      { title: "Data model & setup — Meridian supply graph" },
      {
        name: "description",
        content:
          "Labelled property graph model, the Cypher behind each view, and how to connect and seed a CognoDB instance.",
      },
      { property: "og:title", content: "Data model & setup — Meridian supply graph" },
      {
        property: "og:description",
        content: "Graph model, the Cypher behind each view, and CognoDB connection and seeding steps.",
      },
    ],
  }),
  component: ModelPage,
});

const DIAGRAM = `(:Region {id,name,riskLevel})
   ^                         ^
   | LOCATED_IN              | LOCATED_IN
(:Supplier {id,name,tier,reliability})     (:Factory {id,name,capacity})
   |  SUPPLIES {leadTimeDays,unitCost}          |  ASSEMBLES
   v                                            v
(:Part {id,name,category}) --PART_OF {qty}--> (:Part) --PART_OF--> (:Product {id,name,line})

(:Shipment {id,status,eta}) -CARRIES-> (:Part)
(:Shipment) -FROM-> (:Supplier)   (:Shipment) -TO-> (:Factory)
(:RiskEvent {id,type,severity}) -AFFECTS-> (:Region)`;

const QUERIES: { title: string; note: string; cypher: string }[] = [
  {
    title: "Impact analysis (multi-hop)",
    note: "Two or more hops: supplier → part → sub-assemblies → finished product.",
    cypher: `MATCH (s:Supplier {id: $supplierId})-[:SUPPLIES]->(p:Part)
MATCH path = (p)-[:PART_OF*1..4]->(prod:Product)
OPTIONAL MATCH (f:Factory)-[:ASSEMBLES]->(prod)
RETURN prod.name AS product, length(path) AS hops,
       [n IN nodes(path) | coalesce(n.name, n.id)] AS path,
       collect(DISTINCT f.name) AS factories
ORDER BY hops, product`,
  },
  {
    title: "Region exposure (multi-hop aggregation)",
    note: "Counts distinct products reachable from each region's suppliers.",
    cypher: `MATCH (reg:Region)
OPTIONAL MATCH (e:RiskEvent)-[:AFFECTS]->(reg)
OPTIONAL MATCH (reg)<-[:LOCATED_IN]-(:Supplier)-[:SUPPLIES]->(:Part)
              -[:PART_OF*1..4]->(prod:Product)
RETURN reg.name AS region, reg.riskLevel AS riskLevel,
       collect(DISTINCT e.type) AS events,
       count(DISTINCT prod) AS exposedProducts
ORDER BY exposedProducts DESC`,
  },
  {
    title: "Single-source parts",
    note: "Structural risk: parts with exactly one incoming SUPPLIES relationship.",
    cypher: `MATCH (p:Part)<-[sup:SUPPLIES]-(s:Supplier)
WITH p, collect({s: s, sup: sup}) AS sources
WHERE size(sources) = 1
WITH p, sources[0] AS only
OPTIONAL MATCH (only.s)-[:LOCATED_IN]->(reg:Region)
RETURN p.name AS part, only.s.name AS supplier,
       reg.name AS region, only.sup.leadTimeDays AS leadTimeDays
ORDER BY leadTimeDays DESC`,
  },
  {
    title: "Shipment routes",
    note: "Three relationships resolved in one pattern instead of three SQL joins.",
    cypher: `MATCH (sh:Shipment)-[:CARRIES]->(p:Part)
MATCH (sh)-[:FROM]->(s:Supplier)
MATCH (sh)-[:TO]->(f:Factory)
WHERE $status IS NULL OR sh.status = $status
RETURN sh.id AS id, sh.status AS status, sh.eta AS eta,
       p.name AS part, s.name AS from, f.name AS to
ORDER BY sh.eta`,
  },
];

function ModelPage() {
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-5 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Data model &amp; setup</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Labelled nodes, typed relationships and properties on both. Every query below is
          parameterised and executed through the official Neo4j JavaScript driver over Bolt.
        </p>
      </div>

      <Panel title="Why a graph database?" >
        <div className="max-w-3xl space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            The interesting questions in a supply chain are about connections of unknown depth. A
            bill of materials nests: a part is made of parts, which are made of parts. Asking "which
            finished products stop if this Tier-3 supplier fails?" means walking that hierarchy
            until it terminates — depth is data, not schema.
          </p>
          <p>
            Relationally this is a recursive CTE over a self-joining table, and every extra
            dimension (shipments, regions, risk events) adds another join table and another set of
            indexes. In the property graph the traversal is the storage model: each hop is a
            pointer, so <span className="font-mono text-foreground">[:PART_OF*1..4]</span> costs the
            same shape of work whether the assembly is two levels deep or five.
          </p>
          <p>
            Relationships also carry their own properties — lead time and unit cost live on
            SUPPLIES, not on a junction row — so a path can be scored while it is being walked.
            That is what makes shortest-path and exposure queries expressible in a few lines here
            and awkward anywhere else.
          </p>
        </div>
      </Panel>

      <Panel title="Graph model" subtitle="Labels, relationship types and key properties">
        <pre className="overflow-x-auto border border-border bg-background/50 p-4 font-mono text-xs leading-relaxed text-muted-foreground">
{DIAGRAM}
        </pre>
      </Panel>

      <Panel title="Queries behind the views" subtitle="All parameterised — no string-concatenated Cypher">
        <div className="space-y-5">
          {QUERIES.map((q) => (
            <article key={q.title}>
              <h3 className="text-sm font-semibold">{q.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{q.note}</p>
              <pre className="mt-2 overflow-x-auto border border-border bg-background/50 p-4 font-mono text-xs leading-relaxed">
{q.cypher}
              </pre>
            </article>
          ))}
        </div>
      </Panel>

      <Panel title="Connect &amp; seed" subtitle="Environment variables only; nothing is committed">
        <ol className="max-w-3xl list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            Create a free CognoDB Cloud instance and copy its Bolt connection URI and generated
            password.
          </li>
          <li>
            Provide{" "}
            <span className="font-mono text-foreground">
              NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD
            </span>{" "}
            (optionally <span className="font-mono text-foreground">NEO4J_DATABASE</span>) as
            environment variables.
          </li>
          <li>
            Load the seed data:{" "}
            <span className="font-mono text-foreground">bun run scripts/seed.mjs</span> — it creates
            constraints and writes suppliers, parts, products, factories, regions, shipments and
            risk events idempotently.
          </li>
          <li>Reload this console; every view queries the live instance.</li>
        </ol>
      </Panel>
    </main>
  );
}
