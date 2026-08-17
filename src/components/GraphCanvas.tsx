import { useEffect, useMemo, useRef, useState } from "react";
import type { GraphEdge, GraphNode } from "@/lib/graph-types";

const GROUP_CLASS: Record<string, string> = {
  Supplier: "fill-supplier",
  Part: "fill-part",
  Product: "fill-product",
  Factory: "fill-factory",
  Region: "fill-region",
  Shipment: "fill-shipment",
  RiskEvent: "fill-risk",
};

type Point = { x: number; y: number; vx: number; vy: number };

const WIDTH = 960;
const HEIGHT = 560;

function seedPositions(nodes: GraphNode[]): Record<string, Point> {
  const out: Record<string, Point> = {};
  nodes.forEach((node, i) => {
    const angle = (i / Math.max(1, nodes.length)) * Math.PI * 2;
    const radius = 140 + ((i * 37) % 130);
    out[node.id] = {
      x: WIDTH / 2 + Math.cos(angle) * radius,
      y: HEIGHT / 2 + Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
    };
  });
  return out;
}

/** Lightweight force-directed layout rendered as SVG — no charting dependency. */
export function GraphCanvas({
  nodes,
  edges,
  onSelect,
  selectedId,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onSelect?: (node: GraphNode) => void;
  selectedId?: string | null;
}) {
  const [positions, setPositions] = useState<Record<string, Point>>(() => seedPositions(nodes));
  const frame = useRef<number | null>(null);

  const links = useMemo(
    () => edges.filter((e) => e.source !== e.target),
    [edges],
  );

  useEffect(() => {
    let pts = seedPositions(nodes);
    setPositions(pts);
    let iteration = 0;

    const step = () => {
      iteration += 1;
      const next: Record<string, Point> = {};
      for (const [id, p] of Object.entries(pts)) next[id] = { ...p };

      // repulsion
      const ids = Object.keys(next);
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const a = next[ids[i]!]!;
          const b = next[ids[j]!]!;
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          if (dist > 320) continue;
          const force = 1600 / (dist * dist);
          dx = (dx / dist) * force;
          dy = (dy / dist) * force;
          a.vx += dx;
          a.vy += dy;
          b.vx -= dx;
          b.vy -= dy;
        }
      }

      // springs
      for (const link of links) {
        const a = next[link.source];
        const b = next[link.target];
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const force = (dist - 110) * 0.008;
        a.vx += (dx / dist) * force;
        a.vy += (dy / dist) * force;
        b.vx -= (dx / dist) * force;
        b.vy -= (dy / dist) * force;
      }

      for (const p of Object.values(next)) {
        p.vx += (WIDTH / 2 - p.x) * 0.001;
        p.vy += (HEIGHT / 2 - p.y) * 0.001;
        p.vx *= 0.82;
        p.vy *= 0.82;
        p.x = Math.max(24, Math.min(WIDTH - 24, p.x + p.vx));
        p.y = Math.max(24, Math.min(HEIGHT - 24, p.y + p.vy));
      }

      pts = next;
      setPositions(next);
      if (iteration < 220) frame.current = requestAnimationFrame(step);
    };

    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [nodes, links]);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-[560px] w-full"
      role="img"
      aria-label="Supply chain graph visualisation"
    >
      <g>
        {links.map((edge, i) => {
          const a = positions[edge.source];
          const b = positions[edge.target];
          if (!a || !b) return null;
          const active = selectedId === edge.source || selectedId === edge.target;
          return (
            <line
              key={`${edge.source}-${edge.target}-${edge.type}-${i}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className={active ? "stroke-primary" : "stroke-border"}
              strokeWidth={active ? 1.6 : 0.8}
            />
          );
        })}
      </g>
      <g>
        {nodes.map((node) => {
          const p = positions[node.id];
          if (!p) return null;
          const selected = selectedId === node.id;
          return (
            <g
              key={node.id}
              transform={`translate(${p.x} ${p.y})`}
              onClick={() => onSelect?.(node)}
              className="cursor-pointer"
            >
              <circle
                r={selected ? 9 : 6}
                className={`${GROUP_CLASS[node.group] ?? "fill-muted-foreground"} ${
                  selected ? "stroke-foreground" : "stroke-background"
                }`}
                strokeWidth={1.5}
              />
              {(selected || nodes.length <= 60) && (
                <text
                  x={11}
                  y={4}
                  className="fill-foreground font-mono"
                  fontSize={9}
                >
                  {node.name}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
