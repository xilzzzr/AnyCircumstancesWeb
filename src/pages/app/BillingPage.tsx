import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CreditCard, Download, Check, Zap, Shield, Users, Building2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

type PlanId = "starter" | "plus" | "commercial" | "enterprise";

type Invoice = {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: "paid" | "pending" | "failed";
  invoiceUrl: string | null;
};

type BillingPlan = {
  id: "starter" | "plus" | "commercial";
  name: string;
  priceMonthlyUsd: number;
  storageLimitMb: number;
  overageRateUsdPerGb: number;
};

type BillingSummary = {
  subscription: { userId: string; planId: "starter" | "plus" | "commercial"; status: "active" | "canceled" };
  plan: BillingPlan;
  invoices: Invoice[];
};

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:3001";

const plans = [
  {
    id: "starter" as const,
    name: "Starter",
    description: "Get started with essential protection",
    price: 4.99,
    storage: "5 GB",
    storageLimit: 5000,
    overageRate: 0.75,
    features: [
      "Secure file storage",
      "Inactivity check-ins",
      "Automated delivery to trusted contacts",
      "Email reminders",
      "Optional 2FA",
    ],
    icon: Shield,
  },
  {
    id: "plus" as const,
    name: "Plus",
    description: "More control and priority support",
    price: 12.99,
    storage: "20 GB",
    storageLimit: 20000,
    overageRate: 0.65,
    features: [
      "Everything in Starter",
      "Priority support",
      "Advanced release options",
      "Custom verification schedules",
      "Multiple notification channels",
    ],
    icon: Zap,
    popular: true,
  },
  {
    id: "commercial" as const,
    name: "Commercial",
    description: "For teams and organizations",
    price: 75,
    storage: "200 GB",
    storageLimit: 200000,
    overageRate: 0.4,
    features: [
      "Everything in Plus",
      "Multi-user / team support",
      "Dedicated onboarding",
      "Team management dashboard",
      "Activity audit logs",
    ],
    icon: Users,
  },
  {
    id: "enterprise" as const,
    name: "Enterprise",
    description: "Custom solutions for high-volume needs",
    price: null,
    storage: "Custom",
    storageLimit: null,
    overageRate: null,
    features: [
      "Everything in Commercial",
      "Custom storage allocations",
      "Volume-based pricing discounts",
      "Dedicated account manager",
      "Custom SLA",
      "API access",
    ],
    icon: Building2,
    isEnterprise: true,
  },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatBytes(bytes: number) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  const rounded = i === 0 ? String(Math.round(v)) : v.toFixed(v >= 10 ? 1 : 2);
  return `${rounded} ${units[i]}`;
}

async function fetchJson(path: string, init?: RequestInit) {
  const r = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const body = await r.json().catch(() => null);
  if (!r.ok) {
    const err = new Error(body?.error || `http_${r.status}`);
    (err as any).status = r.status;
    throw err;
  }
  return body;
}

export function BillingPage() {
  const { toast } = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<BillingSummary | null>(null);

  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      try {
        const res = await fetchJson("/auth/billing/summary?limit=50");
        if (!alive) return;
        setSummary(res as BillingSummary);
      } catch (e: any) {
        if (!alive) return;

        const code = String(e?.message || "server_error");
        if (e?.status === 401 || code === "not_authenticated") {
          toast({
            title: "Session expired",
            description: "Please log in again.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Couldn’t load billing",
            description: code,
            variant: "destructive",
          });
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [toast]);

  const userPlanId = (summary?.subscription?.planId || "starter") as PlanId;
  const currentPlan = useMemo(() => {
    const p = plans.find((x) => x.id === userPlanId);
    return p || plans[0];
  }, [userPlanId]);

  const effectiveStorageLimitMb = useMemo(() => {
    const backendLimit = summary?.plan?.storageLimitMb;
    if (Number.isFinite(backendLimit)) return Number(backendLimit);
    if (typeof currentPlan.storageLimit === "number") return currentPlan.storageLimit;
    return 0;
  }, [summary, currentPlan]);

  const storageUsedMb = Number((user as any)?.storageUsed || 0);
  const storageLimitMb = Number((user as any)?.storageLimit || effectiveStorageLimitMb || 0);
  const hasStorage = Number.isFinite(storageUsedMb) && Number.isFinite(storageLimitMb) && storageLimitMb > 0;
  const storagePercentage = hasStorage ? (storageUsedMb / storageLimitMb) * 100 : 0;

  const invoices = summary?.invoices || [];

  const handleUpgrade = () => {
    setSelectedPlan(null);
    setUpgradeDialogOpen(true);
  };

  const handleSelectPlan = (planId: PlanId) => {
    setSelectedPlan(planId);
  };

  const handleConfirmUpgrade = async () => {
    if (!selectedPlan) return;
    if (selectedPlan === "enterprise") {
      toast({
        title: "Contact us",
        description: "Enterprise is handled manually for now.",
      });
      return;
    }

    setSavingPlan(true);
    try {
      const res = await fetchJson("/auth/billing/choose-plan?limit=50", {
        method: "POST",
        body: JSON.stringify({ planId: selectedPlan }),
      });

      setSummary(res as BillingSummary);

      const plan = plans.find((p) => p.id === selectedPlan);
      toast({
        title: "Plan updated",
        description: plan ? `You’re now on ${plan.name}.` : "Your plan was updated.",
      });

      setUpgradeDialogOpen(false);
      setSelectedPlan(null);
    } catch (e: any) {
      const code = String(e?.message || "server_error");
      toast({
        title: "Couldn’t update plan",
        description: code,
        variant: "destructive",
      });
    } finally {
      setSavingPlan(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Billing & Subscription</h1>
        <p className="text-muted-foreground">Manage your plan, storage, and payment methods</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Current Plan
              <Badge variant="secondary" className="capitalize">
                {loading ? "Loading…" : currentPlan.name}
              </Badge>
            </CardTitle>
            <CardDescription>{currentPlan.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading billing…
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">
                    {currentPlan.price === null ? "Contact us" : `$${currentPlan.price}`}
                  </span>
                  {currentPlan.price !== null && <span className="text-muted-foreground">/month</span>}
                </div>
                <p className="text-sm text-muted-foreground">
                  {currentPlan.storage} included
                  {currentPlan.overageRate !== null ? ` • Overage: $${currentPlan.overageRate}/GB/month` : ""}
                </p>
                <ul className="space-y-2">
                  {currentPlan.features.slice(0, 4).map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button className="w-full" variant="outline" onClick={handleUpgrade}>
                  <Zap className="h-4 w-4 mr-2" />
                  Upgrade Plan
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Storage Usage</CardTitle>
            <CardDescription>Your current storage consumption</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{hasStorage ? `${formatBytes(storageUsedMb * 1024 * 1024)} used` : "—"}</span>
                <span className="text-muted-foreground">
                  {hasStorage ? `${formatBytes(storageLimitMb * 1024 * 1024)} limit` : "Billing not wired yet"}
                </span>
              </div>
              <Progress value={storagePercentage} className="h-3" />
              <p className="text-xs text-muted-foreground">
                {hasStorage ? `${storagePercentage.toFixed(1)}% of your storage is used` : "Storage usage will show here once wired."}
              </p>
            </div>
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">Need more storage?</p>
              <Button variant="secondary" size="sm" onClick={handleUpgrade} disabled={loading}>
                Upgrade Plan
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment Method</CardTitle>
          <CardDescription>Your saved payment information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">Not connected yet</p>
                <p className="text-sm text-muted-foreground">Stripe will be wired later</p>
              </div>
            </div>
            <Button variant="outline" size="sm" disabled>
              Update
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
          <CardDescription>Your past invoices and payments</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : invoices.length === 0 ? (
            <div className="text-sm text-muted-foreground">No invoices yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Invoice</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>{formatDate(invoice.date)}</TableCell>
                    <TableCell>{invoice.description}</TableCell>
                    <TableCell>${invoice.amount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          invoice.status === "paid"
                            ? "default"
                            : invoice.status === "pending"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {invoice.invoiceUrl ? (
                        <a href={invoice.invoiceUrl} target="_blank" rel="noreferrer">
                          <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                        </a>
                      ) : (
                        <Button variant="ghost" size="sm" disabled>
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={upgradeDialogOpen} onOpenChange={(v) => !savingPlan && setUpgradeDialogOpen(v)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Choose a Plan</DialogTitle>
            <DialogDescription>
              Select the plan that best fits your needs. Stripe billing will be wired later, but we’ll still save your selection.
            </DialogDescription>
          </DialogHeader>

          <div className="grid sm:grid-cols-2 gap-4 py-4">
            {plans.map((plan) => {
              const IconComponent = plan.icon;
              const isCurrentPlan = plan.id === userPlanId;
              const isSelected = plan.id === selectedPlan;

              return (
                <div
                  key={plan.id}
                  onClick={() => !isCurrentPlan && !plan.isEnterprise && handleSelectPlan(plan.id)}
                  className={cn(
                    "relative rounded-xl p-4 border-2 transition-all cursor-pointer",
                    isSelected && "border-primary bg-primary/5",
                    isCurrentPlan && "border-muted bg-muted/30 cursor-default opacity-60",
                    !isSelected && !isCurrentPlan && "border-border hover:border-primary/50",
                    plan.isEnterprise && "cursor-default"
                  )}
                >
                  {plan.popular && (
                    <Badge className="absolute -top-2 right-4" variant="default">
                      Popular
                    </Badge>
                  )}
                  {isCurrentPlan && (
                    <Badge className="absolute -top-2 right-4" variant="secondary">
                      Current
                    </Badge>
                  )}

                  <div className="flex items-center gap-2 mb-2">
                    <IconComponent className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">{plan.name}</h3>
                  </div>

                  <p className="text-sm text-muted-foreground mb-3">{plan.description}</p>

                  {plan.price !== null ? (
                    <div className="mb-3">
                      <span className="text-2xl font-bold">${plan.price}</span>
                      <span className="text-muted-foreground">/month</span>
                      <p className="text-xs text-muted-foreground mt-1">
                        {plan.storage} included • ${plan.overageRate}/GB overage
                      </p>
                    </div>
                  ) : (
                    <div className="mb-3">
                      <span className="text-lg font-bold">Contact us</span>
                      <p className="text-xs text-muted-foreground mt-1">Custom pricing</p>
                    </div>
                  )}

                  <ul className="space-y-1">
                    {plan.features.slice(0, 3).map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Check className="h-3 w-3 text-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUpgradeDialogOpen(false)} disabled={savingPlan}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmUpgrade}
              disabled={!selectedPlan || selectedPlan === userPlanId || savingPlan}
            >
              {savingPlan ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving…
                </>
              ) : (
                "Confirm Upgrade"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
