import { createServerFn } from "@tanstack/react-start";
import {
  guard,
  fetchOverview,
  fetchNetwork,
  fetchSuppliers,
  fetchImpact,
  fetchSingleSourceRisk,
  fetchRegionRisk,
  fetchShipments,
  fetchShortestPath,
} from "./queries.server";

export const getOverview = createServerFn({ method: "GET" }).handler(async () =>
  guard(() => fetchOverview()),
);

export const getNetwork = createServerFn({ method: "GET" })
  .inputValidator((input: { region?: string | null; limit?: number }) => ({
    region: input?.region ?? null,
    limit: Math.min(400, Math.max(10, Math.trunc(input?.limit ?? 150))),
  }))
  .handler(async ({ data }) => guard(() => fetchNetwork(data.region, data.limit)));

export const getSuppliers = createServerFn({ method: "GET" }).handler(async () =>
  guard(() => fetchSuppliers()),
);

export const getImpact = createServerFn({ method: "POST" })
  .inputValidator((input: { supplierId: string; maxHops?: number }) => {
    if (!input?.supplierId || typeof input.supplierId !== "string") {
      throw new Error("supplierId is required");
    }
    return { supplierId: input.supplierId, maxHops: input.maxHops ?? 4 };
  })
  .handler(async ({ data }) => guard(() => fetchImpact(data.supplierId, data.maxHops)));

export const getSingleSourceRisk = createServerFn({ method: "GET" }).handler(async () =>
  guard(() => fetchSingleSourceRisk()),
);

export const getRegionRisk = createServerFn({ method: "GET" }).handler(async () =>
  guard(() => fetchRegionRisk()),
);

export const getShipments = createServerFn({ method: "GET" })
  .inputValidator((input: { status?: string | null }) => ({ status: input?.status ?? null }))
  .handler(async ({ data }) => guard(() => fetchShipments(data.status)));

export const getShortestPath = createServerFn({ method: "POST" })
  .inputValidator((input: { fromId: string; toId: string }) => {
    if (!input?.fromId || !input?.toId) throw new Error("fromId and toId are required");
    return { fromId: input.fromId, toId: input.toId };
  })
  .handler(async ({ data }) => guard(() => fetchShortestPath(data.fromId, data.toId)));
