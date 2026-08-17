import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getNetwork, getRegionRisk } from "@/lib/graph.functions";
import { GraphCanvas } from "@/components/GraphCanvas";
import { Panel, LoadingState, ErrorState, EmptyState } from "@/components/DataState";
import type { GraphNode } from "@/lib/graph-types";

export const Route = createFileRoute("/network")({
  head: () => ({
    meta: [
      { title: "Network view — Meridian supply graph" },
      {
        name: "description",
        content:
          "Interactive force-directed view of suppliers, parts, products, factories and shipments, filterable by region.",
      },
      { property: "og:title", content: "Network view — Meridian supply graph" },
      {
        property: "og:description",
        content: "Interactive force-directed view of the supply chain graph, filterable by region.",
      },
    ],
  }),
  component: NetworkPage,
});

const LEGEND: [string, string][] = [
  ["Supplier", "bg-supplier"],
  ["Part", "bg-part"],
  ["Product", "bg-product"],
  ["Factory", "bg-factory"],
  ["Region", "bg-region"],
  ["Shipment", "bg-shipment"],
  ["RiskEvent", "bg-risk"],
];

function NetworkPage() {
  const [region, setRegion] = useState<string | null>(null);
  const [limit, setLimit] = useState(150);
  const [selected, setSelected] = useState<GraphNode | null>(null);

  const regions = useQuery({ queryKey: ["region-risk"], queryFn: () => getRegionRisk() });
  const network = useQuery({
    queryKey: ["network", region, limit],
    queryFn: () => getNetwork({ data: { region, limit } }),
  });

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-5 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Network view</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Every edge below is a typed relationship returned by a single Cypher pattern match. Click
          a node to inspect it and highlight its connections.
        </p>
      </div>

      <Panel
        title="Graph explorer"
        subtitle={network.data?.ok ? `${network.data.data.nodes.length} nodes rendered` : undefined}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by region"
              value={region ?? ""}
              onChange={(e) => setRegion(e.target.value || null)}
              className="border border-input bg-background px-3 py-1.5 text-sm"
            >
              <option value="">All regions</option>
              {regions.data?.ok &&
                regions.data.data.map((r) => (
                  <option key={r.region} value={r.region}>
                    {r.region}
                  </option>
                ))}
            </select>
            <select
              aria-label="Edge limit"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="border border-input bg-background px-3 py-1.5 text-sm"
            >
              {[60, 150, 300].map((n) => (
                <option key={n} value={n}>
                  {n} edges
                </option>
              ))}
            </select>
          </div>
        }
      >
        {network.isLoading && <LoadingState label="Traversing graph" />}
        {network.data?.ok === false && <ErrorState message={network.data.error} />}
        {network.data?.ok &&
          (network.data.data.nodes.length === 0 ? (
            <EmptyState message="No relationships matched. Try another region or run the seed script." />
          ) : (
            <>
              <div className="flex flex-wrap gap-4 pb-3">
                {LEGEND.map(([label, cls]) => (
                  <span key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={`h-2.5 w-2.5 rounded-full ${cls}`} />
                    {label}
                  </span>
                ))}
              </div>
              <div className="overflow-hidden border border-border bg-background/40">
                <GraphCanvas
                  nodes={network.data.data.nodes}
                  edges={network.data.data.edges}
                  onSelect={setSelected}
                  selectedId={selected?.id ?? null}
                />
              </div>
              <div className="mt-4 border border-border bg-background/40 px-4 py-3 text-sm">
                {selected ? (
                  <>
                    <p className="label-caps">{selected.label}</p>
                    <p className="mt-1 font-mono">{selected.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {network.data.data.edges.filter(
                        (e) => e.source === selected.id || e.target === selected.id,
                      ).length}{" "}
                      relationships in the current view
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">Select a node to inspect it.</p>
                )}
              </div>
            </>
          ))}
      </Panel>
    </main>
  );
}
