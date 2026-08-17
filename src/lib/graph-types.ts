export type GraphNode = { id: string; label: string; name: string; group: string };
export type GraphEdge = { source: string; target: string; type: string };
export type GraphPayload = { nodes: GraphNode[]; edges: GraphEdge[] };
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };
