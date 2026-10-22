import React from "react";

type Props = { children: React.ReactNode };
type State = { error?: Error };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Error messages and component diagnostics can contain user input. Do not emit them.
    if (import.meta.env.DEV) console.error("[ErrorBoundary] component rendering failed");
  }

  render() {
    if (this.state.error) {
      const chunkFailure = /ChunkLoadError|Loading chunk|dynamically imported module|Importing a module script failed|module script.*failed/i.test(
        `${this.state.error.name} ${this.state.error.message}`,
      );
      return (
        <main className="min-h-[60vh] p-8" role="alert">
          <div className="max-w-3xl mx-auto rounded-2xl border border-border bg-card p-6">
            <h1 className="text-xl font-semibold text-foreground mb-2">
              {chunkFailure ? "This page could not be loaded." : "Something went wrong while loading this page."}
            </h1>
            <p className="text-muted-foreground mb-4">
              {chunkFailure ? "The application may have been updated. Reload to try again." : "Please try again or return to your dashboard."}
            </p>
            <div className="flex flex-wrap gap-4">
              {!chunkFailure && <button className="underline" onClick={() => this.setState({ error: undefined })}>Try again</button>}
              <button className="underline" onClick={() => window.location.reload()}>Reload page</button>
              {/* A full navigation also clears React.lazy's cached rejection. */}
              <a className="underline" href="/app">Return to dashboard</a>
            </div>
            {import.meta.env.DEV && (
              <pre className="mt-4 whitespace-pre-wrap break-words text-sm rounded-xl bg-muted/40 p-4 text-foreground">
                {String(this.state.error.stack || this.state.error.message)}
              </pre>
            )}
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}

