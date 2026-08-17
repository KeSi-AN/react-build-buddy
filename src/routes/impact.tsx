import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getImpact, getSuppliers } from "@/lib/graph.functions";
import { Panel, LoadingState, ErrorState, EmptyState } from "@/components/DataState";

export const Route = createFileRoute("/impact")({
  head: () => ({
    meta: [
      { title: "Impact analysis — Meridian supply graph" },
      {
        name: "description",
        content:
          "Multi-hop traversal from any supplier through sub-assemblies to every finished product and factory it affects.",
      },
      { property: "og:title", content: "Impact analysis — Meridian supply graph" },
      {
        property: "og:description",
        content: "Trace a supplier through sub-assemblies to every product and factory it affects.",
      },
    ],
  }),
  component: ImpactPage,
});

function ImpactPage() {
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [maxHops, setMaxHops] = useState(4);

  const suppliers = useQuery({ queryKey: ["suppliers"], queryFn: () => getSuppliers() });

  useEffect(() => {
    if (!supplierId && suppliers.data?.ok && suppliers.data.data.length > 0) {
      setSupplierId(suppliers.data.data[0]!.id);
    }
  }, [suppliers.data, supplierId]);

  const impact = useQuery({
    queryKey: ["impact", supplierId, maxHops],
    queryFn: () => getImpact({ data: { supplierId: supplierId!, maxHops } }),
    enabled: Boolean(supplierId),
  });

  const selected =
    suppliers.data?.ok ? suppliers.data.data.find((s) => s.id === supplierId) : undefined;

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-5 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Impact analysis</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Pick a supplier and walk the graph: SUPPLIES to parts, then PART_OF through as many
          sub-assembly levels as you allow, ending at finished products and the factories that
          assemble them.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Panel title="Source supplier">
          {suppliers.isLoading && <LoadingState label="Loading suppliers" />}
          {suppliers.data?.ok === false && <ErrorState message={suppliers.data.error} />}
          {suppliers.data?.ok && (
            <div className="space-y-4">
              <label className="block">
                <span className="label-caps">Supplier</span>
                <select
                  value={supplierId ?? ""}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="mt-1 w-full border border-input bg-background px-3 py-2 text-sm"
                >
                  {suppliers.data.data.map((s) => (
                    <option key={s.id} value={s.id}>
                      T{s.tier} · {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label-caps">Max assembly hops: {maxHops}</span>
                <input
                  type="range"
                  min={1}
                  max={6}
                  value={maxHops}
                  onChange={(e) => setMaxHops(Number(e.target.value))}
                  className="mt-2 w-full accent-[var(--primary)]"
                />
              </label>
              {selected && (
                <dl className="space-y-1 border border-border bg-background/40 px-3 py-2 font-mono text-xs">
                  <Row label="region" value={selected.region} />
                  <Row label="tier" value={`T${selected.tier}`} />
                  <Row
                    label="reliability"
                    value={
                      typeof selected.reliability === "number"
                        ? `${Math.round(selected.reliability * 100)}%`
                        : "n/a"
                    }
                  />
                </dl>
              )}
            </div>
          )}
        </Panel>

        <Panel
          title="Downstream exposure"
          subtitle={impact.data?.ok ? `${impact.data.data.length} product paths` : undefined}
        >
          {(impact.isLoading || (!supplierId && suppliers.isSuccess)) && (
            <LoadingState label="Traversing assemblies" />
          )}
          {impact.data?.ok === false && <ErrorState message={impact.data.error} />}
          {impact.data?.ok &&
            (impact.data.data.length === 0 ? (
              <EmptyState message="No finished products reachable within this hop limit." />
            ) : (
              <ul className="divide-y divide-border">
                {impact.data.data.map((row, i) => (
                  <li key={`${row.product}-${i}`} className="py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-medium">{row.product}</p>
                      <p className="label-caps">
                        {row.hops} hop{row.hops === 1 ? "" : "s"} · {row.productLine ?? "—"}
                      </p>
                    </div>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {row.path.join(" → ")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Assembled at: {row.factories.join(", ")}
                    </p>
                  </li>
                ))}
              </ul>
            ))}
        </Panel>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
