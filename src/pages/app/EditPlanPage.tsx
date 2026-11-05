import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useNavigate } from "react-router-dom";
import { safeInternalPath } from "@/lib/navigation";
import { computePlanPrice, formatMoney, getFrequencyPrice, type CheckInFrequencyId } from "@/lib/pricing";
import { isFrequency, normalizeStorageGb } from "@/lib/pendingPlan";
import { StorageSlider } from "@/components/pricing/StorageSlider";
import { PlannedFeaturesNote } from "@/components/pricing/PlannedFeaturesNote";
import { Loader2 } from "lucide-react";

type ApiResult = { ok: boolean; url?: string; error?: string; frequency?: string };

type BillingSummary = {
  ok: boolean;
  billing?: {
    status?: string;
    storageLimitGb?: number;
    checkInFrequency?: string;
    billingInterval?: string;
    addons?: string[];
  };
  error?: string;
};

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { method: "GET", credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `http_${res.status}`);
  return data as T;
}

async function postJson(path: string, body: unknown): Promise<ApiResult> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || `http_${res.status}`, frequency: data?.frequency };
  return data;
}

function useReturnTo() {
  const loc = useLocation();
  const params = new URLSearchParams(loc.search);
  return safeInternalPath(params.get("returnTo"), "/app/billing");
}

export default function EditPlanPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const returnTo = useReturnTo();

  const [initializing, setInitializing] = useState(true);
  const [storageGb, setStorageGb] = useState(5);
  const [checkInFrequency, setCheckInFrequency] = useState<CheckInFrequencyId>("monthly");
  const [isAnnual, setIsAnnual] = useState(false);
  const [loading, setLoading] = useState(false);

  const billingInterval: "monthly" | "annual" = isAnnual ? "annual" : "monthly";

  useEffect(() => {
    let alive = true;

    async function loadExisting() {
      setInitializing(true);
      try {
        const data = await fetchJson<BillingSummary>("/auth/billing/summary?limit=1");
        if (!alive) return;

        const status = String(data?.billing?.status || "");
        const isPaid = status === "active" || status === "trial" || status === "trialing";
        if (!isPaid) {
          toast({
            title: "No active plan to edit",
            description: "Choose a plan first.",
            variant: "destructive",
          });
          navigate("/app/plan?returnTo=/app/billing");
          return;
        }

        const freq = data?.billing?.checkInFrequency;
        const interval = data?.billing?.billingInterval;

        setStorageGb(normalizeStorageGb(data?.billing?.storageLimitGb) ?? 5);
        setCheckInFrequency(isFrequency(freq) ? freq : "monthly");
        setIsAnnual(interval === "annual");
      } catch (e) {
        if (!alive) return;
        toast({
          title: "Could not load your current plan",
          description: e instanceof Error ? e.message : "server_error",
          variant: "destructive",
        });
        navigate("/app/billing");
      } finally {
        if (alive) setInitializing(false);
      }
    }

    loadExisting();
    return () => {
      alive = false;
    };
  }, [navigate, toast]);

  const pricing = useMemo(() => {
    const p = computePlanPrice({
      storageGb,
      addons: [],
      checkInFrequency,
      billingInterval,
    });

    const annualTotal = p.annualTotal ?? p.monthlyTotal * 10;

    return {
      storage: p.storage,
      frequency: p.frequency,
      monthlyTotal: p.monthlyTotal,
      annualTotal,
    };
  }, [storageGb, checkInFrequency, billingInterval]);

  const updatePlan = async () => {
    setLoading(true);
    try {
      // The backend rejects add-ons; none are available to purchase.
      const out = await postJson("/auth/billing/update-plan", {
        storageGb,
        checkInFrequency,
        billingInterval,
        addons: [],
      });

      if (!out.ok) {
        if (out.error === "frequency_locked" && out.frequency) {
          toast({
            title: "Check-in frequency is locked by your plan",
            description: `Your paid frequency is currently ${out.frequency}.`,
            variant: "destructive",
          });
        } else {
          toast({ title: "Could not update plan", description: out.error || "server_error", variant: "destructive" });
        }
        return;
      }

      toast({ title: "Plan updated", description: "Your subscription has been updated." });
      navigate(returnTo);
    } catch {
      toast({ title: "Could not update plan", description: "Could not reach the server. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const checkInLabel = (freq: CheckInFrequencyId) => {
    if (freq === "daily") return "Daily / scheduled";
    if (freq === "weekly") return "Weekly";
    return "Monthly";
  };

  const checkInHint = (freq: CheckInFrequencyId) => {
    if (freq === "monthly") return "Every 30 days · included";
    if (freq === "weekly") return `Every 7 days · +${formatMoney(getFrequencyPrice("weekly"))}/mo`;
    return `Daily or custom calendar · +${formatMoney(getFrequencyPrice("daily"))}/mo`;
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Edit your plan</CardTitle>
          <CardDescription>Adjust storage, check-ins, and billing. Your current plan stays active unless you save changes.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-8">
          {initializing ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading your current plan…
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <Label>Storage (GB)</Label>
                    <div className="text-xs text-muted-foreground mt-1">{formatMoney(pricing.storage)}/mo</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold">{storageGb} GB</div>
                  </div>
                </div>

                <StorageSlider value={storageGb} onChange={setStorageGb} disabled={loading} />
              </div>

              <div className="space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <Label id="edit-frequency-label">Check-in frequency</Label>
                    <div className="text-xs text-muted-foreground mt-1">{formatMoney(pricing.frequency)}/mo</div>
                  </div>
                </div>

                <RadioGroup
                  aria-labelledby="edit-frequency-label"
                  value={checkInFrequency}
                  onValueChange={(v) => {
                    if (isFrequency(v)) setCheckInFrequency(v);
                  }}
                  className="space-y-3"
                  disabled={loading}
                >
                  {(["monthly", "weekly", "daily"] as const).map((freq) => (
                    <label
                      key={freq}
                      className={`flex min-h-11 items-center justify-between gap-3 rounded-lg border p-3 cursor-pointer ${checkInFrequency === freq ? "border-primary bg-primary/5" : ""}`}
                      htmlFor={`freq-${freq}`}
                    >
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value={freq} id={`freq-${freq}`} />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{checkInLabel(freq)}</span>
                          <span className="text-xs text-muted-foreground">{checkInHint(freq)}</span>
                        </div>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg border p-3">
                <div className="flex flex-col">
                  <Label htmlFor="annual">Annual billing</Label>
                  <div className="text-xs text-muted-foreground mt-1">10 × the monthly price, billed once a year up front, renews yearly</div>
                </div>
                <Switch id="annual" checked={isAnnual} onCheckedChange={setIsAnnual} disabled={loading} />
              </div>

              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Storage ({storageGb} GB)</span>
                  <span>{formatMoney(pricing.storage)}/mo</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Check-ins ({checkInLabel(checkInFrequency)})</span>
                  <span>{formatMoney(pricing.frequency)}/mo</span>
                </div>

                <div aria-live="polite" aria-atomic="true" className="border-t pt-3">
                  <div className="flex justify-between">
                    <span className="font-medium">Total</span>
                    <span className="font-semibold">
                      {isAnnual ? `${formatMoney(pricing.annualTotal)} / year` : `${formatMoney(pricing.monthlyTotal)} / month`}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {isAnnual
                      ? `Charged once a year up front (10 × ${formatMoney(pricing.monthlyTotal)}), renews yearly. USD.`
                      : "Charged every month, renews monthly. USD."}
                  </div>
                </div>
              </div>

              <PlannedFeaturesNote />

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button variant="outline" className="min-h-11" onClick={() => navigate(returnTo)} disabled={loading}>Exit without saving</Button>
                <Button className="min-h-11" onClick={updatePlan} disabled={loading}>
                  {loading ? "Updating..." : "Update my plan"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
