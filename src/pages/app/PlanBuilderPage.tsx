import React, { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "react-router-dom";
import { safeInternalPath } from "@/lib/navigation";
import { computePlanPrice, formatMoney } from "@/lib/pricing";
import { Phone, MessageSquare, MapPin } from "lucide-react";

type ApiResult = { ok: boolean; url?: string; error?: string };

async function postJson(path: string, body: any): Promise<ApiResult> {
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

function useReturnTo() {
  const loc = useLocation();
  const params = new URLSearchParams(loc.search);
  return safeInternalPath(params.get("returnTo"), "/app");
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

export default function PlanBuilderPage() {
  const { toast } = useToast();
  const returnTo = useReturnTo();

  const [storageGb, setStorageGb] = useState(5);
  const [checkInFrequency, setCheckInFrequency] = useState<"monthly" | "weekly" | "daily">("monthly");
  const [isAnnual, setIsAnnual] = useState(false);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const billingInterval: "monthly" | "annual" = isAnnual ? "annual" : "monthly";

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
      savings: p.monthlyTotal * 2,
    };
  }, [storageGb, selectedAddons, checkInFrequency, billingInterval]);

  const displayPriceFrom = useMemo(() => {
    const base = computePlanPrice({
      storageGb: 5,
      addons: [],
      checkInFrequency: "monthly",
      billingInterval: "monthly",
    });
    return formatMoney(base.monthlyTotal);
  }, []);

  const toggleAddon = (id: string) => {
    setSelectedAddons((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const startCheckout = async () => {
    setLoading(true);
    try {
      const out = await postJson("/auth/billing/create-checkout-session", {
        storageGb,
        checkInFrequency,
        billingInterval,
        addons: selectedAddons,
      });

      if (!out.ok || !out.url) {
        toast({ title: "Could not start checkout", description: out.error || "server_error" });
        return;
      }

      window.location.href = out.url;
    } finally {
      setLoading(false);
    }
  };

  const checkInLabel = (freq: "monthly" | "weekly" | "daily") => {
    if (freq === "daily") return "Daily / scheduled";
    if (freq === "weekly") return "Weekly";
    return "Monthly";
  };

  const checkInHint = (freq: "monthly" | "weekly" | "daily") => {
    if (freq === "monthly") return `Included`;
    if (freq === "weekly") return `+${formatMoney(1.99)}/mo`;
    return `+${formatMoney(2.99)}/mo · Choose days, times, and recurrence`;
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Build your plan</CardTitle>
          <CardDescription>
            Plans start at {displayPriceFrom}/month. Pick storage, check-ins, and add-ons.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-8">
          <div className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <Label>Storage (GB)</Label>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatMoney(pricing.storage)}/mo
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold">{storageGb} GB</div>
              </div>
            </div>

            <Slider
              value={[storageGb]}
              onValueChange={(v) => setStorageGb(v[0] || 5)}
              min={5}
              max={200}
              step={5}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <Label>Check-in frequency</Label>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatMoney(pricing.frequency)}/mo
                </div>
              </div>
            </div>

            <RadioGroup value={checkInFrequency} onValueChange={(v) => setCheckInFrequency(v as any)} className="space-y-3">
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
                <div className="text-xs text-muted-foreground mt-1">
                  {formatMoney(pricing.addons)}/mo
                </div>
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
            <Switch id="annual" checked={isAnnual} onCheckedChange={setIsAnnual} />
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
                {isAnnual
                  ? `${formatMoney(pricing.annualTotal)} / year`
                  : `${formatMoney(pricing.monthlyTotal)} / month`}
              </span>
            </div>

            {isAnnual && (
              <div className="text-xs text-muted-foreground">
                Equivalent to ~{formatMoney(pricing.annualMonthly)}/mo (billed yearly)
              </div>
            )}
          </div>

          <Button onClick={startCheckout} disabled={loading} className="w-full">
            {loading ? "Starting checkout..." : "Continue to checkout"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
