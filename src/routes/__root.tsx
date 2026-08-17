import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

const NAV = [
  { to: "/", label: "Overview" },
  { to: "/network", label: "Network" },
  { to: "/impact", label: "Impact" },
  { to: "/risk", label: "Risk" },
  { to: "/shipments", label: "Shipments" },
  { to: "/model", label: "Data model" },
] as const;

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-mono text-6xl font-bold text-primary">404</h1>
        <h2 className="mt-4 text-lg font-semibold">No such view</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This route isn't part of the supply chain console.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
        >
          Back to overview
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">This view didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something failed while rendering. Try again, or return to the overview.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary"
          >
            Overview
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Meridian — Supply Chain Graph Console" },
      {
        name: "description",
        content:
          "Explore suppliers, parts, factories and shipments as a connected graph with multi-hop impact analysis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen">
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
            <Link to="/" className="flex items-center gap-2">
              <span className="h-3 w-3 bg-primary" />
              <span className="font-mono text-sm font-semibold tracking-tight">MERIDIAN</span>
              <span className="label-caps hidden sm:inline">supply graph</span>
            </Link>
            <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  activeOptions={{ exact: item.to === "/" }}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  activeProps={{ className: "text-primary" }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        {/* Required: nested routes render here. */}
        <Outlet />
        <footer className="mx-auto max-w-7xl px-5 py-10 text-xs text-muted-foreground">
          Data layer: CognoDB (Bolt 5.x, official Neo4j JavaScript driver). Credentials are read
          from environment variables at runtime.
        </footer>
      </div>
    </QueryClientProvider>
  );
}
