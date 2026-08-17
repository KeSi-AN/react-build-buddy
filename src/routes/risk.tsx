import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getRegionRisk, getSingleSourceRisk } from "@/lib/graph.functions";
import { Panel, LoadingState, ErrorState, EmptyState } from "@/components/DataState";

export const Route = createFileRoute("/risk")({
  head: () => ({
    meta: [
      { title: "Risk register — Meridian supply graph" },
      {
        name: "description",
        content:
          "Single-source parts and region concentration risk, computed with aggregation over graph patterns.",
      },
      { property: "og:title", content: "Risk register — Meridian supply graph" },
      {
        property: "og:description",
        content: "Single-source parts and region concentration risk across the supply graph.",
      },
    ],
  }),
  component: RiskPage,
});

function RiskPage() {
  const single = useQuery({ queryKey: ["single-source"], queryFn: () => getSingleSourceRisk() });
  const regions = useQuery({ queryKey: ["region-risk"], queryFn: () => getRegionRisk() });

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-5 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Risk register</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Two structural risks the graph answers directly: parts with exactly one incoming SUPPLIES
          relationship, and regions whose suppliers reach the most finished products.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Single-source parts"
          subtitle={single.data?.ok ? `${single.data.data.length} parts with one supplier` : undefined}
        >
          {single.isLoading && <LoadingState />}
          {single.data?.ok === false && <ErrorState message={single.data.error} />}
          {single.data?.ok &&
            (single.data.data.length === 0 ? (
              <EmptyState message="Every part has at least two suppliers." />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="label-caps py-2">Part</th>
                    <th className="label-caps py-2">Sole supplier</th>
                    <th className="label-caps py-2 text-right">Lead time</th>
                  </tr>
                </thead>
                <tbody>
                  {single.data.data.map((row) => (
                    <tr key={row.part} className="border-b border-border/60">
                      <td className="py-2 pr-3">{row.part}</td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {row.supplier}
                        <span className="block text-xs">{row.region}</span>
                      </td>
                      <td className="py-2 text-right font-mono">
                        {row.leadTimeDays ?? "—"}
                        {row.leadTimeDays ? "d" : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
        </Panel>

        <Panel title="Region concentration" subtitle="Distinct products reachable per region">
          {regions.isLoading && <LoadingState />}
          {regions.data?.ok === false && <ErrorState message={regions.data.error} />}
          {regions.data?.ok && <RegionBars rows={regions.data.data} />}
        </Panel>
      </div>
    </main>
  );
}

function RegionBars({
  rows,
}: {
  rows: { region: string; riskLevel: string; events: string[]; exposedProducts: number }[];
}) {
  if (rows.length === 0) return <EmptyState message="No regions loaded yet." />;
  const max = Math.max(...rows.map((r) => r.exposedProducts), 1);
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.region}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span>{row.region}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {row.exposedProducts} products · {row.riskLevel ?? "unrated"}
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full bg-secondary">
            <div className="h-full bg-primary" style={{ width: `${(row.exposedProducts / max) * 100}%` }} />
          </div>
          {row.events.filter(Boolean).length > 0 && (
            <p className="mt-1 text-xs text-destructive">{row.events.filter(Boolean).join(" · ")}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
