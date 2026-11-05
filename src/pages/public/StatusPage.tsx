import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type CheckState =
  | { kind: "checking" }
  | { kind: "up"; at: Date; ms: number }
  | { kind: "down"; at: Date; reason: string };

const TIMEOUT_MS = 8000;

export function StatusPage() {
  const [state, setState] = useState<CheckState>({ kind: "checking" });
  const controller = useRef<AbortController | null>(null);

  const runCheck = useCallback(async () => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const timer = window.setTimeout(() => abort.abort(), TIMEOUT_MS);
    setState({ kind: "checking" });
    const started = performance.now();
    try {
      const res = await fetch("/health", { cache: "no-store", signal: abort.signal, credentials: "omit" });
      const body = res.ok ? await res.json().catch(() => null) : null;
      if (res.ok && body?.ok === true) {
        setState({ kind: "up", at: new Date(), ms: Math.round(performance.now() - started) });
      } else {
        setState({ kind: "down", at: new Date(), reason: `The service didn’t give the expected answer (HTTP ${res.status}).` });
      }
    } catch {
      if (controller.current !== abort) return;
      setState({ kind: "down", at: new Date(), reason: "Your browser couldn’t reach the service. This can also be caused by your own connection." });
    } finally {
      window.clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    void runCheck();
    return () => controller.current?.abort();
  }, [runCheck]);

  const time = (date: Date) => date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className="container mx-auto max-w-3xl px-4 py-16 md:py-24">
      <p className="micro-label"><span className="status-dot" aria-hidden="true" /> STATUS</p>
      <h1 className="mt-6 text-4xl md:text-6xl">Service status</h1>
      <p className="mt-6 text-lg text-muted-foreground">
        A live check, run from your browser right now, that the AnyCircumstances account and file service is responding.
      </p>

      <section aria-labelledby="live-check" className="mt-10 rounded-2xl border bg-card p-6 sm:p-8">
        <h2 id="live-check" className="flex items-center gap-3 text-xl font-semibold">
          <Activity aria-hidden="true" className="h-5 w-5 text-primary" /> Live check
        </h2>
        <div role="status" aria-live="polite" className="mt-5">
          {state.kind === "checking" && <p className="text-lg text-muted-foreground">Checking…</p>}
          {state.kind === "up" && (
            <>
              <p className="flex items-center gap-3 text-lg font-medium text-foreground">
                <span aria-hidden="true" className="h-3 w-3 rounded-full bg-[hsl(var(--success))]" /> Responding
              </p>
              <p className="mt-2 text-muted-foreground">The service answered in {state.ms} ms. Checked at {time(state.at)}.</p>
            </>
          )}
          {state.kind === "down" && (
            <>
              <p className="flex items-center gap-3 text-lg font-medium text-foreground">
                <span aria-hidden="true" className="h-3 w-3 rounded-full bg-[hsl(var(--destructive))]" /> Not responding
              </p>
              <p className="mt-2 text-muted-foreground">{state.reason} Checked at {time(state.at)}.</p>
            </>
          )}
        </div>
        <Button type="button" variant="outline" className="mt-6 min-h-11 gap-2" onClick={() => void runCheck()} disabled={state.kind === "checking"}>
          <RefreshCw aria-hidden="true" className="h-4 w-4" /> Check again
        </Button>
      </section>

      <section aria-labelledby="scope" className="mt-10 space-y-4 leading-7 text-muted-foreground">
        <h2 id="scope" className="text-xl font-semibold text-foreground">What this check covers</h2>
        <p>
          It confirms that the service behind sign-in, check-ins and file access is answering requests. It doesn’t test email
          delivery, the scheduled processing of check-ins and releases, or file storage, and it isn’t a history of past
          incidents. AnyCircumstances doesn’t publish an incident history yet.
        </p>
        <p>
          Having trouble? Email{" "}
          <a className="text-primary underline underline-offset-4" href="mailto:contact@anycircumstances.com">contact@anycircumstances.com</a>
          {" "}or read the <Link to="/faq" className="text-primary underline underline-offset-4">FAQ</Link>.
        </p>
      </section>
    </div>
  );
}
