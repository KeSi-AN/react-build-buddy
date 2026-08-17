import type { ReactNode } from "react";

export function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string | undefined;
  action?: ReactNode | undefined;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function LoadingState({ label = "Querying graph" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-10 text-sm text-muted-foreground">
      <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
      <span className="font-mono">{label}…</span>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
      <p className="font-mono text-xs uppercase tracking-widest text-destructive">
        Graph unavailable
      </p>
      <p className="mt-2 text-muted-foreground">{message}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        Connection details are read from NEO4J_URI, NEO4J_USERNAME and NEO4J_PASSWORD.
      </p>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <p className="py-10 text-center text-sm text-muted-foreground">{message}</p>
  );
}
