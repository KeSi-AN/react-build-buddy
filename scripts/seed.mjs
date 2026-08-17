#!/usr/bin/env node
/**
 * Seeds the supply chain graph into CognoDB / Neo4j.
 *
 *   NEO4J_URI=bolt+s://<instance>.cognodb.cloud \
 *   NEO4J_USERNAME=cognodb NEO4J_PASSWORD=***** \
 *   bun run scripts/seed.mjs [--reset]
 *
 * Idempotent: every write uses MERGE. Pass --reset to delete existing data first.
 */
import neo4j from "neo4j-driver";

const uri = process.env.NEO4J_URI;
const username = process.env.NEO4J_USERNAME;
const password = process.env.NEO4J_PASSWORD;
const database = process.env.NEO4J_DATABASE || "neo4j";

if (!uri || !username || !password) {
  console.error("Missing NEO4J_URI, NEO4J_USERNAME or NEO4J_PASSWORD in the environment.");
  process.exit(1);
}

const regions = [
  { id: "reg-shenzhen", name: "Shenzhen", riskLevel: "elevated" },
  { id: "reg-penang", name: "Penang", riskLevel: "moderate" },
  { id: "reg-bengaluru", name: "Bengaluru", riskLevel: "moderate" },
  { id: "reg-monterrey", name: "Monterrey", riskLevel: "low" },
  { id: "reg-eindhoven", name: "Eindhoven", riskLevel: "low" },
  { id: "reg-nagoya", name: "Nagoya", riskLevel: "elevated" },
];

const suppliers = [
  { id: "sup-anodex", name: "Anodex Metals", tier: 3, reliability: 0.91, region: "reg-shenzhen" },
  { id: "sup-luminar", name: "Luminar Optics", tier: 2, reliability: 0.96, region: "reg-nagoya" },
  { id: "sup-kestrel", name: "Kestrel Polymers", tier: 3, reliability: 0.84, region: "reg-penang" },
  { id: "sup-orbis", name: "Orbis Semiconductor", tier: 2, reliability: 0.88, region: "reg-shenzhen" },
  { id: "sup-verda", name: "Verda Cells", tier: 2, reliability: 0.93, region: "reg-bengaluru" },
  { id: "sup-halden", name: "Halden Precision", tier: 1, reliability: 0.97, region: "reg-eindhoven" },
  { id: "sup-corvo", name: "Corvo Harnessing", tier: 2, reliability: 0.79, region: "reg-monterrey" },
  { id: "sup-solace", name: "Solace Glassworks", tier: 3, reliability: 0.9, region: "reg-penang" },
];

const factories = [
  { id: "fac-monterrey", name: "Monterrey Assembly", capacity: 12000, region: "reg-monterrey" },
  { id: "fac-eindhoven", name: "Eindhoven Works", capacity: 7400, region: "reg-eindhoven" },
  { id: "fac-penang", name: "Penang Line 4", capacity: 9800, region: "reg-penang" },
];

const parts = [
  { id: "prt-alu-housing", name: "Aluminium Housing", category: "Enclosure" },
  { id: "prt-lens-array", name: "Lens Array", category: "Optics" },
  { id: "prt-cover-glass", name: "Cover Glass", category: "Optics" },
  { id: "prt-polymer-seal", name: "Polymer Seal", category: "Sealing" },
  { id: "prt-image-sensor", name: "Image Sensor", category: "Silicon" },
  { id: "prt-mcu", name: "Control MCU", category: "Silicon" },
  { id: "prt-battery-cell", name: "Battery Cell", category: "Power" },
  { id: "prt-wire-harness", name: "Wire Harness", category: "Interconnect" },
  { id: "prt-camera-module", name: "Camera Module", category: "Sub-assembly" },
  { id: "prt-power-pack", name: "Power Pack", category: "Sub-assembly" },
  { id: "prt-mainboard", name: "Mainboard", category: "Sub-assembly" },
  { id: "prt-optical-stack", name: "Optical Stack", category: "Sub-assembly" },
];

const products = [
  { id: "prd-sentry-9", name: "Sentry 9 Inspection Camera", line: "Industrial vision" },
  { id: "prd-atlas-r2", name: "Atlas R2 Field Scanner", line: "Field survey" },
  { id: "prd-nova-lite", name: "Nova Lite Drone Pod", line: "Aerial" },
];

const supplies = [
  ["sup-anodex", "prt-alu-housing", 21, 14.5],
  ["sup-halden", "prt-alu-housing", 12, 19.2],
  ["sup-luminar", "prt-lens-array", 30, 42.0],
  ["sup-solace", "prt-cover-glass", 18, 6.75],
  ["sup-kestrel", "prt-polymer-seal", 9, 1.2],
  ["sup-orbis", "prt-image-sensor", 45, 88.4],
  ["sup-orbis", "prt-mcu", 38, 12.9],
  ["sup-verda", "prt-battery-cell", 26, 9.3],
  ["sup-corvo", "prt-wire-harness", 15, 4.1],
  ["sup-halden", "prt-mainboard", 20, 61.0],
];

const partOf = [
  ["prt-lens-array", "prt-optical-stack", 1],
  ["prt-cover-glass", "prt-optical-stack", 1],
  ["prt-optical-stack", "prt-camera-module", 1],
  ["prt-image-sensor", "prt-camera-module", 1],
  ["prt-polymer-seal", "prt-camera-module", 2],
  ["prt-battery-cell", "prt-power-pack", 4],
  ["prt-wire-harness", "prt-power-pack", 1],
  ["prt-mcu", "prt-mainboard", 1],
];

const partOfProduct = [
  ["prt-camera-module", "prd-sentry-9", 2],
  ["prt-mainboard", "prd-sentry-9", 1],
  ["prt-alu-housing", "prd-sentry-9", 1],
  ["prt-camera-module", "prd-atlas-r2", 1],
  ["prt-power-pack", "prd-atlas-r2", 1],
  ["prt-alu-housing", "prd-atlas-r2", 1],
  ["prt-power-pack", "prd-nova-lite", 1],
  ["prt-optical-stack", "prd-nova-lite", 1],
];

const assembles = [
  ["fac-monterrey", "prd-sentry-9"],
  ["fac-eindhoven", "prd-atlas-r2"],
  ["fac-penang", "prd-nova-lite"],
];

const shipments = [
  { id: "shp-1041", status: "In transit", eta: "2026-09-02", part: "prt-image-sensor", from: "sup-orbis", to: "fac-monterrey" },
  { id: "shp-1042", status: "Delayed", eta: "2026-09-06", part: "prt-lens-array", from: "sup-luminar", to: "fac-penang" },
  { id: "shp-1043", status: "Delivered", eta: "2026-08-14", part: "prt-alu-housing", from: "sup-halden", to: "fac-eindhoven" },
  { id: "shp-1044", status: "Customs hold", eta: "2026-09-11", part: "prt-battery-cell", from: "sup-verda", to: "fac-eindhoven" },
  { id: "shp-1045", status: "In transit", eta: "2026-09-04", part: "prt-wire-harness", from: "sup-corvo", to: "fac-monterrey" },
  { id: "shp-1046", status: "In transit", eta: "2026-09-09", part: "prt-cover-glass", from: "sup-solace", to: "fac-penang" },
];

const riskEvents = [
  { id: "rsk-typhoon", type: "Typhoon season disruption", severity: "high", region: "reg-shenzhen" },
  { id: "rsk-port", type: "Port congestion", severity: "medium", region: "reg-penang" },
  { id: "rsk-quake", type: "Seismic advisory", severity: "medium", region: "reg-nagoya" },
];

const driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
const session = driver.session({ database, defaultAccessMode: neo4j.session.WRITE });

async function run(cypher, params = {}) {
  await session.run(cypher, params);
}

try {
  await driver.verifyConnectivity();
  console.log(`Connected to ${uri} (database: ${database})`);

  if (process.argv.includes("--reset")) {
    console.log("Deleting existing data…");
    await run("MATCH (n) DETACH DELETE n");
  }

  for (const label of ["Region", "Supplier", "Factory", "Part", "Product", "Shipment", "RiskEvent"]) {
    await run(`CREATE CONSTRAINT ${label.toLowerCase()}_id IF NOT EXISTS
               FOR (n:${label}) REQUIRE n.id IS UNIQUE`);
  }

  await run(`UNWIND $rows AS row MERGE (r:Region {id: row.id})
             SET r.name = row.name, r.riskLevel = row.riskLevel`, { rows: regions });

  await run(`UNWIND $rows AS row
             MERGE (s:Supplier {id: row.id})
             SET s.name = row.name, s.tier = row.tier, s.reliability = row.reliability
             WITH s, row MATCH (r:Region {id: row.region}) MERGE (s)-[:LOCATED_IN]->(r)`,
    { rows: suppliers });

  await run(`UNWIND $rows AS row
             MERGE (f:Factory {id: row.id})
             SET f.name = row.name, f.capacity = row.capacity
             WITH f, row MATCH (r:Region {id: row.region}) MERGE (f)-[:LOCATED_IN]->(r)`,
    { rows: factories });

  await run(`UNWIND $rows AS row MERGE (p:Part {id: row.id})
             SET p.name = row.name, p.category = row.category`, { rows: parts });

  await run(`UNWIND $rows AS row MERGE (p:Product {id: row.id})
             SET p.name = row.name, p.line = row.line`, { rows: products });

  await run(`UNWIND $rows AS row
             MATCH (s:Supplier {id: row[0]}), (p:Part {id: row[1]})
             MERGE (s)-[rel:SUPPLIES]->(p)
             SET rel.leadTimeDays = row[2], rel.unitCost = row[3]`, { rows: supplies });

  await run(`UNWIND $rows AS row
             MATCH (a:Part {id: row[0]}), (b:Part {id: row[1]})
             MERGE (a)-[rel:PART_OF]->(b) SET rel.quantity = row[2]`, { rows: partOf });

  await run(`UNWIND $rows AS row
             MATCH (a:Part {id: row[0]}), (b:Product {id: row[1]})
             MERGE (a)-[rel:PART_OF]->(b) SET rel.quantity = row[2]`, { rows: partOfProduct });

  await run(`UNWIND $rows AS row
             MATCH (f:Factory {id: row[0]}), (p:Product {id: row[1]})
             MERGE (f)-[:ASSEMBLES]->(p)`, { rows: assembles });

  await run(`UNWIND $rows AS row
             MERGE (sh:Shipment {id: row.id})
             SET sh.status = row.status, sh.eta = row.eta
             WITH sh, row
             MATCH (p:Part {id: row.part}), (s:Supplier {id: row.from}), (f:Factory {id: row.to})
             MERGE (sh)-[:CARRIES]->(p)
             MERGE (sh)-[:FROM]->(s)
             MERGE (sh)-[:TO]->(f)`, { rows: shipments });

  await run(`UNWIND $rows AS row
             MERGE (e:RiskEvent {id: row.id})
             SET e.type = row.type, e.severity = row.severity
             WITH e, row MATCH (r:Region {id: row.region}) MERGE (e)-[:AFFECTS]->(r)`,
    { rows: riskEvents });

  const summary = await session.run("MATCH (n) RETURN count(n) AS nodes");
  console.log(`Seed complete — ${summary.records[0].get("nodes")} nodes in the graph.`);
} catch (error) {
  console.error("Seeding failed:", error.message);
  process.exitCode = 1;
} finally {
  await session.close();
  await driver.close();
}
