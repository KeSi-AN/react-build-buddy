# Meridian — Supply Chain Graph Console

A React application backed by a graph database (CognoDB, Bolt 5.x, official Neo4j JavaScript
driver). It models a manufacturing supply chain — suppliers, parts, sub-assemblies, products,
factories, regions, shipments and risk events — and lets a non-technical user answer connection
questions that are painful in a relational schema.

Stack: React 19 + TanStack Start (SSR, server functions) + TanStack Query + Tailwind v4.

## Why a graph database?

The interesting questions in a supply chain are about connections of unknown depth. A bill of
materials nests: a part is made of parts, which are made of parts. "Which finished products stop if
this Tier-3 supplier fails?" means walking that hierarchy until it terminates — depth is data, not
schema.

Relationally, that is a recursive CTE over a self-joining table, and every extra dimension
(shipments, regions, risk events) adds another junction table and another set of indexes. In a
labelled property graph the traversal *is* the storage model: each hop is a pointer, so
`[:PART_OF*1..4]` costs the same shape of work whether an assembly is two levels deep or five.

Relationships also carry properties — `leadTimeDays` and `unitCost` live on `SUPPLIES`, not on a
junction row — so a path can be scored while it is walked. That is what makes exposure and
shortest-path queries a few lines here and awkward anywhere else.

## Data model

```text
(:Region {id,name,riskLevel})
   ^                         ^
   | LOCATED_IN              | LOCATED_IN
(:Supplier {id,name,tier,reliability})     (:Factory {id,name,capacity})
   |  SUPPLIES {leadTimeDays,unitCost}          |  ASSEMBLES
   v                                            v
(:Part {id,name,category}) --PART_OF {quantity}--> (:Part) --PART_OF--> (:Product {id,name,line})

(:Shipment {id,status,eta}) -CARRIES-> (:Part)
(:Shipment) -FROM-> (:Supplier)     (:Shipment) -TO-> (:Factory)
(:RiskEvent {id,type,severity}) -AFFECTS-> (:Region)
```

Uniqueness constraints exist on `id` for every label.

## Setup

1. Create a free CognoDB Cloud instance (console.cognodb.com) and copy the Bolt connection URI and
   the generated password for user `cognodb`.
2. Provide connection details as environment variables — nothing is committed to the repository:

   ```bash
   NEO4J_URI=bolt+s://<instance-id>-databases.cognodb.cloud
   NEO4J_USERNAME=cognodb
   NEO4J_PASSWORD=<generated password>
   NEO4J_DATABASE=neo4j   # optional
   ```

3. Seed the graph (idempotent; `--reset` clears first):

   ```bash
   bun run scripts/seed.mjs
   bun run scripts/seed.mjs --reset
   ```

4. Run the app:

   ```bash
   bun install
   bun run dev
   ```

If the database is unreachable or unconfigured, every view degrades to an explicit "graph
unavailable" panel rather than a blank screen.

## Views

| Route        | What it answers                                                              |
| ------------ | ---------------------------------------------------------------------------- |
| `/`          | Live node/relationship inventory and region exposure                          |
| `/network`   | Force-directed graph explorer, filterable by region, click a node to inspect  |
| `/impact`    | Multi-hop trace: supplier → part → sub-assemblies → products and factories    |
| `/risk`      | Single-source parts and region concentration risk                             |
| `/shipments` | Shipments joining part, origin supplier and destination factory               |
| `/model`     | Data model, the Cypher behind each view, and setup instructions               |

## Main queries

All Cypher is parameterised through the driver — no string-concatenated queries.

Impact analysis (multi-hop, ≥2 hops):

```cypher
MATCH (s:Supplier {id: $supplierId})-[:SUPPLIES]->(p:Part)
MATCH path = (p)-[:PART_OF*1..4]->(prod:Product)
OPTIONAL MATCH (f:Factory)-[:ASSEMBLES]->(prod)
RETURN prod.name AS product, length(path) AS hops,
       [n IN nodes(path) | coalesce(n.name, n.id)] AS path,
       collect(DISTINCT f.name) AS factories
ORDER BY hops, product
```

Region exposure (multi-hop aggregation):

```cypher
MATCH (reg:Region)
OPTIONAL MATCH (e:RiskEvent)-[:AFFECTS]->(reg)
OPTIONAL MATCH (reg)<-[:LOCATED_IN]-(:Supplier)-[:SUPPLIES]->(:Part)-[:PART_OF*1..4]->(prod:Product)
RETURN reg.name AS region, reg.riskLevel AS riskLevel,
       collect(DISTINCT e.type) AS events, count(DISTINCT prod) AS exposedProducts
ORDER BY exposedProducts DESC
```

Single-source risk, shipment routing and shortest path between two entities are listed on `/model`
and implemented in `src/lib/queries.server.ts`.

## Project structure

```text
src/lib/neo4j.server.ts     driver singleton, env config, value coercion, error mapping
src/lib/queries.server.ts   all Cypher, one function per question
src/lib/graph.functions.ts  server functions (RPC) exposed to the React app
src/components/             graph canvas (SVG force layout) and shared UI states
src/routes/                 one route per view, each with its own head() metadata
scripts/seed.mjs            idempotent seed script
```

The browser never talks to the database directly: queries run server-side through TanStack server
functions, so credentials stay on the server.
