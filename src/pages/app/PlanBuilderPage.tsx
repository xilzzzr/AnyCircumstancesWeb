import { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "react-router-dom";
import { computePlanPrice, formatMoney, getFrequencyPrice, type CheckInFrequencyId } from "@/lib/pricing";
import { DEFAULT_PLAN, clearPendingPlan, isFrequency, planFromSearchParams, readPendingPlan } from "@/lib/pendingPlan";
import { StorageSlider } from "@/components/pricing/StorageSlider";
import { PlannedFeaturesNote } from "@/components/pricing/PlannedFeaturesNote";

type ApiResult = { ok: boolean; url?: string; error?: string };

async function postJson(path: string, body: unknown): Promise<ApiResult> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || `http_${res.status}` };
  return data;
}

function checkoutErrorMessage(code: string | undefined) {
  if (code === "subscription_already_active") return "You already have an active plan. You can change it from Billing.";
  if (code === "not_authenticated" || code === "invalid_session") return "Your session has expired. Please sign in again.";
  if (code === "invalid_plan") return "That plan selection isn’t valid. Adjust your choices and try again.";
  return "We couldn’t start checkout. You have not been charged. Please try again in a moment.";
}

export default function PlanBuilderPage() {
  const { toast } = useToast();
  const location = useLocation();

  // Preload a selection from ?storage=&frequency=&billing= or the plan picked on
  // /pricing before signup; otherwise start from the default plan.
  const [initialPlan] = useState(() => planFromSearchParams(location.search) ?? readPendingPlan() ?? DEFAULT_PLAN);

  const [storageGb, setStorageGb] = useState(initialPlan.storageGb);
  const [checkInFrequency, setCheckInFrequency] = useState<CheckInFrequencyId>(initialPlan.frequency);
  const [isAnnual, setIsAnnual] = useState(initialPlan.billing === "annual");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const billingInterval: "monthly" | "annual" = isAnnual ? "annual" : "monthly";

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

  const displayPriceFrom = useMemo(() => {
    const base = computePlanPrice({
      storageGb: 5,
      addons: [],
      checkInFrequency: "monthly",
      billingInterval: "monthly",
    });
    return formatMoney(base.monthlyTotal);
  }, []);

  const startCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const out = await postJson("/auth/billing/create-checkout-session", {
        storageGb,
        checkInFrequency,
        billingInterval,
        addons: [],
      });

      if (!out.ok || !out.url) {
        const message = checkoutErrorMessage(out.error);
        setError(message);
        toast({ title: "Could not start checkout", description: message, variant: "destructive" });
        setLoading(false);
        return;
      }

      clearPendingPlan();
      window.location.href = out.url;
    } catch {
      const message = checkoutErrorMessage(undefined);
      setError(message);
      toast({ title: "Could not start checkout", description: message, variant: "destructive" });
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
          <CardTitle>Build your plan</CardTitle>
          <CardDescription>
            Plans start at {displayPriceFrom}/month. Pick storage, check-in frequency and billing. There’s no free plan or trial — files can be stored once your plan is active.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-8">
          <div className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <Label id="plan-storage-label">Storage (GB)</Label>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatMoney(pricing.storage)}/mo · the most your encrypted files can add up to
                </div>
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
                <Label id="plan-frequency-label">Check-in frequency</Label>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatMoney(pricing.frequency)}/mo
                </div>
              </div>
            </div>

            <RadioGroup
              aria-labelledby="plan-frequency-label"
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
                  {isAnnual
                    ? `${formatMoney(pricing.annualTotal)} / year`
                    : `${formatMoney(pricing.monthlyTotal)} / month`}
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

          <div className="space-y-3">
            <Button onClick={startCheckout} disabled={loading} className="w-full min-h-11">
              {loading ? "Starting checkout..." : "Continue to checkout"}
            </Button>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">
              Cancel from Account settings at any time. Cancelling ends your plan immediately and permanently deletes your stored files. Payments are non-refundable except where required by law — see{" "}
              <Link to="/terms" className="text-primary underline underline-offset-4">Terms</Link>.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
