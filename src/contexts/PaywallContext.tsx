import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { formatMoney, getPlanCharge } from "@/lib/pricing";

const STARTING_PRICE = formatMoney(getPlanCharge(5, "monthly", "monthly").amount);

type PaywallState = {
  open: boolean;
  title: string;
  description: string;
  returnTo?: string;
};

type PaywallContextValue = {
  openPaywall: (opts?: Partial<PaywallState>) => void;
  closePaywall: () => void;
};

const PaywallContext = createContext<PaywallContextValue | null>(null);

export function PaywallProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [state, setState] = useState<PaywallState>({
    open: false,
    title: "Active plan required",
    description: `This needs an active plan. There’s no free plan or trial — plans start at ${STARTING_PRICE}/month.`,
    returnTo: undefined,
  });

  const value = useMemo<PaywallContextValue>(
    () => ({
      openPaywall: (opts) =>
        setState((s) => ({
          ...s,
          ...opts,
          open: true,
          title: opts?.title || s.title,
          description: opts?.description || s.description,
        })),
      closePaywall: () => setState((s) => ({ ...s, open: false })),
    }),
    []
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ title?: unknown; description?: unknown; returnTo?: unknown } | null>;
      const d = ce?.detail || {};
      setState((s) => ({
        ...s,
        open: true,
        title: String(d.title || s.title),
        description: String(d.description || s.description),
        returnTo: d.returnTo ? String(d.returnTo) : s.returnTo,
      }));
    };

    window.addEventListener("uac:paywall", handler as EventListener);
    return () => window.removeEventListener("uac:paywall", handler as EventListener);
  }, []);

  const goBuildPlan = () => {
    const rt = state.returnTo ? `?returnTo=${encodeURIComponent(state.returnTo)}` : "";
    setState((s) => ({ ...s, open: false }));
    navigate(`/app/plan${rt}`);
  };

  return (
    <PaywallContext.Provider value={value}>
      {children}

      <Dialog open={state.open} onOpenChange={(o) => setState((s) => ({ ...s, open: o }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{state.title}</DialogTitle>
            <DialogDescription>{state.description}</DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setState((s) => ({ ...s, open: false }))}>
              Not now
            </Button>
            <Button onClick={goBuildPlan}>Choose a plan (from {STARTING_PRICE}/month)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PaywallContext.Provider>
  );
}

export function usePaywall() {
  const ctx = useContext(PaywallContext);
  if (!ctx) throw new Error("usePaywall must be used inside PaywallProvider");
  return ctx;
}
