// Share refresh-token rotation across concurrent session checks (including StrictMode).
let pendingSession: Promise<Record<string, unknown>> | null = null;

export function loadAuthSession(): Promise<Record<string, unknown>> {
  if (!pendingSession) {
    pendingSession = (async () => {
      let response = await fetch("/auth/me", { credentials: "include" });
      let session = response.ok ? await response.json() : { ok: false };
      if (response.status === 401 || (response.ok && session.ok === false)) {
        const refreshed = await fetch("/auth/refresh", { method: "POST", credentials: "include" });
        if (refreshed.ok) {
          response = await fetch("/auth/me", { credentials: "include" });
          session = response.ok ? await response.json() : { ok: false };
        }
      }
      return session;
    })().finally(() => { pendingSession = null; });
  }
  return pendingSession;
}
