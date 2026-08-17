import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getOverview, getRegionRisk } from "@/lib/graph.functions";
import { Panel, LoadingState, ErrorState, EmptyState } from "@/components/DataState";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Meridian — Supply Chain Graph Console" },
      {
        name: "description",
        content:
          "Live overview of the supply chain graph: node and relationship counts, region exposure, and entry points into impact analysis.",
      },
      { property: "og:title", content: "Meridian — Supply Chain Graph Console" },
      {
        property: "og:description",
        content:
          "Live overview of the supply chain graph: node and relationship counts and region exposure.",
      },
    ],
  }),
  component: Overview,
});

function Overview() {
  const overview = useQuery({ queryKey: ["overview"], queryFn: () => getOverview() });
  const regions = useQuery({ queryKey: ["region-risk"], queryFn: () => getRegionRisk() });

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-5 py-10">
      <div className="panel px-6 py-8">
        <p className="label-caps">Graph-backed operations console</p>
        <h1 className="mt-3 max-w-2xl text-3xl font-semibold sm:text-4xl">
          Trace a single supplier to every product it can stop.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Meridian models a manufacturing supply chain as labelled nodes and typed relationships in
          CognoDB. Questions that need recursive joins in a relational schema — which finished goods
          depend on a Tier-3 supplier, which regions concentrate risk — are single multi-hop Cypher
          traversals here.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/impact"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Run an impact trace
          </Link>
          <Link
            to="/network"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary"
          >
            Open the network view
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Graph inventory" subtitle="Counted live from the database">
          {overview.isLoading && <LoadingState />}
          {overview.data?.ok === false && <ErrorState message={overview.data.error} />}
          {overview.data?.ok && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Metric label="Nodes" value={overview.data.data.totals.nodes} />
                <Metric label="Relationships" value={overview.data.data.totals.relationships} />
              </div>
              {overview.data.data.labels.length === 0 ? (
                <EmptyState message="The database is reachable but empty. Run the seed script to load data." />
              ) : (
                <div className="grid gap-6 sm:grid-cols-2">
                  <CountList title="By label" rows={overview.data.data.labels.map((l) => [l.label, l.count])} />
                  <CountList
                    title="By relationship"
                    rows={overview.data.data.relationships.map((r) => [r.type, r.count])}
                  />
                </div>
              )}
            </div>
          )}
        </Panel>

        <Panel title="Region exposure" subtitle="Products reachable from suppliers in each region">
          {regions.isLoading && <LoadingState />}
          {regions.data?.ok === false && <ErrorState message={regions.data.error} />}
          {regions.data?.ok &&
            (regions.data.data.length === 0 ? (
              <EmptyState message="No regions loaded yet." />
            ) : (
              <ul className="divide-y divide-border">
                {regions.data.data.map((row) => (
                  <li key={row.region} className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{row.region}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.events.filter(Boolean).length > 0
                          ? row.events.filter(Boolean).join(", ")
                          : "No active risk events"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm">{row.exposedProducts}</p>
                      <p className="label-caps">{row.riskLevel ?? "unrated"}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ))}
        </Panel>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border bg-background/40 px-4 py-3">
      <p className="label-caps">{label}</p>
      <p className="mt-1 font-mono text-2xl text-primary">{value.toLocaleString()}</p>
    </div>
  );
}

function CountList({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <div>
      <p className="label-caps">{title}</p>
      <ul className="mt-2 space-y-1.5 font-mono text-xs">
        {rows.map(([name, count]) => (
          <li key={name} className="flex justify-between gap-3">
            <span className="text-muted-foreground">{name}</span>
            <span>{count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
