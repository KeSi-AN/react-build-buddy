import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getShipments } from "@/lib/graph.functions";
import { Panel, LoadingState, ErrorState, EmptyState } from "@/components/DataState";

export const Route = createFileRoute("/shipments")({
  head: () => ({
    meta: [
      { title: "Shipments — Meridian supply graph" },
      {
        name: "description",
        content:
          "In-transit, delayed and delivered shipments joining suppliers, parts and factories in one traversal.",
      },
      { property: "og:title", content: "Shipments — Meridian supply graph" },
      {
        property: "og:description",
        content: "Shipments joining suppliers, parts and factories in a single graph traversal.",
      },
    ],
  }),
  component: ShipmentsPage,
});

const STATUSES = ["In transit", "Delayed", "Delivered", "Customs hold"];

function ShipmentsPage() {
  const [status, setStatus] = useState<string | null>(null);
  const shipments = useQuery({
    queryKey: ["shipments", status],
    queryFn: () => getShipments({ data: { status } }),
  });

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-5 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Shipments in flight</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          A shipment is a node connected to its part, origin supplier and destination factory — one
          pattern, three joins, no join table.
        </p>
      </div>

      <Panel
        title="Movements"
        subtitle={shipments.data?.ok ? `${shipments.data.data.length} shipments` : undefined}
        action={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setStatus(null)}
              className={`border px-3 py-1.5 text-xs ${
                status === null ? "border-primary text-primary" : "border-border text-muted-foreground"
              }`}
            >
              All
            </button>
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`border px-3 py-1.5 text-xs ${
                  status === s ? "border-primary text-primary" : "border-border text-muted-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        }
      >
        {shipments.isLoading && <LoadingState />}
        {shipments.data?.ok === false && <ErrorState message={shipments.data.error} />}
        {shipments.data?.ok &&
          (shipments.data.data.length === 0 ? (
            <EmptyState message="No shipments match this status." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="label-caps py-2">Shipment</th>
                  <th className="label-caps py-2">Part</th>
                  <th className="label-caps py-2">Route</th>
                  <th className="label-caps py-2">ETA</th>
                  <th className="label-caps py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {shipments.data.data.map((row) => (
                  <tr key={row.id} className="border-b border-border/60">
                    <td className="py-2 pr-3 font-mono text-xs">{row.id}</td>
                    <td className="py-2 pr-3">{row.part}</td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {row.from} → {row.to}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{row.eta}</td>
                    <td
                      className={`py-2 text-right text-xs ${
                        row.status === "Delayed" || row.status === "Customs hold"
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }`}
                    >
                      {row.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
      </Panel>
    </main>
  );
}
