import React from "react";

type Props = { children: React.ReactNode };
type State = { error?: Error };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-[60vh] p-8">
          <div className="max-w-3xl mx-auto rounded-2xl border border-border bg-card p-6">
            <h1 className="text-xl font-semibold text-foreground mb-2">
              Page crashed while rendering
            </h1>
            <p className="text-muted-foreground mb-4">
              This is shown on purpose so we can see the exact error in production.
            </p>
            <pre className="whitespace-pre-wrap break-words text-sm rounded-xl bg-muted/40 p-4 text-foreground">
{String(this.state.error?.stack || this.state.error?.message || this.state.error)}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
