import React, { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useNavigate } from "react-router-dom";
import { safeInternalPath } from "@/lib/navigation";
import { computePlanPrice, formatMoney } from "@/lib/pricing";
import { Phone, MessageSquare, MapPin, Loader2 } from "lucide-react";

type ApiResult = { ok: boolean; url?: string; error?: string; frequency?: string };

type BillingSummary = {
  ok: boolean;
  billing?: {
    status?: string;
    storageLimitGb?: number;
    checkInFrequency?: "monthly" | "weekly" | "daily";
    billingInterval?: "monthly" | "annual";
    addons?: string[];
  };
  error?: string;
};

async function fetchJson(path: string): Promise<any> {
  const res = await fetch(path, { method: "GET", credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `http_${res.status}`);
  return data;
}

async function postJson(path: string, body: any): Promise<ApiResult> {
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

const ADDONS = [
  {
    id: "call-contacts",
    label: "Call emergency contacts",
    description: "We'll call your emergency contacts when triggered",
    priceMonthly: 1.99,
    icon: Phone,
    comingSoon: true,
  },
  {
    id: "text-contacts",
    label: "Text emergency contacts",
    description: "We'll send SMS to your emergency contacts",
    priceMonthly: 0.49,
    icon: MessageSquare,
    comingSoon: true,
  },
  {
    id: "log-location",
    label: "Log location at check-in",
    description: "Record your GPS location each time you check in",
    priceMonthly: 0.99,
    icon: MapPin,
    comingSoon: true,
  },
] as const;

export default function EditPlanPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const returnTo = useReturnTo();

  const [initializing, setInitializing] = useState(true);
  const [storageGb, setStorageGb] = useState(5);
  const [checkInFrequency, setCheckInFrequency] = useState<"monthly" | "weekly" | "daily">("monthly");
  const [isAnnual, setIsAnnual] = useState(false);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const billingInterval: "monthly" | "annual" = isAnnual ? "annual" : "monthly";

  useEffect(() => {
    let alive = true;

    async function loadExisting() {
      setInitializing(true);
      try {
        const data: BillingSummary = await fetchJson("/auth/billing/summary?limit=1");
        if (!alive) return;

        const status = String(data?.billing?.status || "");
        const isPaid = status === "active" || status === "trial" || status === "trialing";
        if (!isPaid) {
          toast({
            title: "No active plan to edit",
            description: "Build a plan first.",
            variant: "destructive",
          });
          navigate("/app/plan?returnTo=/app/billing");
          return;
        }

        const gb = Number(data?.billing?.storageLimitGb ?? 5);
        const freq = (data?.billing?.checkInFrequency || "monthly") as any;
        const interval = (data?.billing?.billingInterval || "monthly") as any;
        const addons = Array.isArray(data?.billing?.addons) ? data!.billing!.addons!.map(String) : [];

        setStorageGb(Number.isFinite(gb) && gb >= 5 ? gb : 5);
        setCheckInFrequency(freq === "daily" || freq === "weekly" || freq === "monthly" ? freq : "monthly");
        setIsAnnual(interval === "annual");
        setSelectedAddons(addons);
      } catch (e: any) {
        if (!alive) return;
        toast({
          title: "Could not load your current plan",
          description: String(e?.message || "server_error"),
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
      addons: selectedAddons,
      checkInFrequency,
      billingInterval,
    });

    const annualTotal = p.annualTotal ?? p.monthlyTotal * 10;

    return {
      storage: p.storage,
      addons: p.addons,
      frequency: p.frequency,
      monthlyTotal: p.monthlyTotal,
      annualTotal,
      annualMonthly: annualTotal / 12,
    };
  }, [storageGb, selectedAddons, checkInFrequency, billingInterval]);

  const toggleAddon = (id: string) => {
    setSelectedAddons((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const updatePlan = async () => {
    setLoading(true);
    try {
      const out = await postJson("/auth/billing/update-plan", {
        storageGb,
        checkInFrequency,
        billingInterval,
        addons: selectedAddons,
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
    } finally {
      setLoading(false);
    }
  };

  const checkInLabel = (freq: "monthly" | "weekly" | "daily") => {
    if (freq === "daily") return "Daily";
    if (freq === "weekly") return "Weekly";
    return "Monthly";
  };

  const checkInHint = (freq: "monthly" | "weekly" | "daily") => {
    if (freq === "monthly") return `Included`;
    if (freq === "weekly") return `+${formatMoney(1.99)}/mo`;
    return `+${formatMoney(2.99)}/mo`;
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Edit your plan</CardTitle>
          <CardDescription>Adjust storage, check-ins, and add-ons. Your current plan stays active unless you save changes.</CardDescription>
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

                <Slider value={[storageGb]} onValueChange={(v) => setStorageGb(v[0] || 5)} min={5} max={200} step={5} />
              </div>

              <div className="space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <Label>Check-in frequency</Label>
                    <div className="text-xs text-muted-foreground mt-1">{formatMoney(pricing.frequency)}/mo</div>
                  </div>
                </div>

                <RadioGroup
                  value={checkInFrequency}
                  onValueChange={(v) => setCheckInFrequency(v as any)}
                  className="space-y-3"
                >
                  {(["monthly", "weekly", "daily"] as const).map((freq) => (
                    <label
                      key={freq}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3 cursor-pointer"
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

              <div className="space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <Label>Add-ons</Label>
                    <div className="text-xs text-muted-foreground mt-1">{formatMoney(pricing.addons)}/mo</div>
                  </div>
                </div>

                <div className="space-y-3">
                  {ADDONS.map((a) => {
                    const checked = selectedAddons.includes(a.id);
                    const Icon = a.icon;
                    return (
                      <label
                        key={a.id}
                        className={`flex items-start gap-3 rounded-lg border p-3 ${a.comingSoon ? "opacity-60" : "cursor-pointer"}`}
                        htmlFor={`addon-${a.id}`}
                      >
                        <Checkbox
                          id={`addon-${a.id}`}
                          checked={checked}
                          onCheckedChange={() => (!a.comingSoon ? toggleAddon(a.id) : null)}
                          disabled={loading || a.comingSoon}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <div className="text-sm font-medium">{a.label}</div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {a.comingSoon ? "Coming soon" : `+${formatMoney(a.priceMonthly)}/mo`}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">{a.description}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="flex flex-col">
                  <Label htmlFor="annual">Annual billing</Label>
                  <div className="text-xs text-muted-foreground mt-1">Pay for 10 months, get 2 free</div>
                </div>
                <Switch id="annual" checked={isAnnual} onCheckedChange={setIsAnnual} disabled={loading} />
              </div>

              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Storage</span>
                  <span>{formatMoney(pricing.storage)}/mo</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Check-ins</span>
                  <span>{formatMoney(pricing.frequency)}/mo</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Add-ons</span>
                  <span>{formatMoney(pricing.addons)}/mo</span>
                </div>

                <div className="border-t pt-3 flex justify-between">
                  <span className="font-medium">Total</span>
                  <span className="font-semibold">
                    {isAnnual ? `${formatMoney(pricing.annualTotal)} / year` : `${formatMoney(pricing.monthlyTotal)} / month`}
                  </span>
                </div>

                {isAnnual && (
                  <div className="text-xs text-muted-foreground">
                    Equivalent to ~{formatMoney(pricing.annualMonthly)}/mo (billed yearly)
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => navigate(returnTo)} disabled={loading}>Exit without saving</Button>
                <Button onClick={updatePlan} disabled={loading}>
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
