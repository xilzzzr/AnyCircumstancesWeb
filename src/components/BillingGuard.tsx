import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { getBillingStatus } from "@/lib/billingStatus";

const ALLOWLIST = new Set(["/app/billing", "/app/help", "/app/settings"]);

export function BillingGuard() {
  const [ready, setReady] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const path = loc.pathname;
        if (ALLOWLIST.has(path)) {
          if (!cancelled) setReady(true);
          return;
        }

        const s = await getBillingStatus();
        if (s.status === "active") {
          if (!cancelled) setReady(true);
          return;
        }

        const next = encodeURIComponent(path + loc.search);
        nav(`/app/billing?next=${next}`, { replace: true });
      } catch {
        nav("/login", { replace: true });
      }
    }

    run();
    return () => { cancelled = true; };
  }, [loc.pathname, loc.search, nav]);

  if (!ready) return null;
  return <Outlet />;
}

