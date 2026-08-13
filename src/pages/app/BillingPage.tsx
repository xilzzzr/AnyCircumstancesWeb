import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CreditCard,
  Download,
  Loader2,
  Shield,
  Calendar,
  Phone,
  MessageSquare,
  MapPin,
  Zap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "";

type Invoice = {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: "paid" | "pending" | "failed";
  invoiceUrl: string | null;
};

type BillingStatus = "trial" | "active" | "paused" | "past_due" | "pending_setup";

type BillingProfile = {
  userId: string;
  status: BillingStatus;
  billingInterval: "monthly" | "annual";
  amountCents: number;
  currency: string;
  storageLimitGb: number;
  checkInFrequency: "monthly" | "weekly" | "daily";
  addons: string[];
  updatedAt?: string;
  currentPeriodEnd?: string | null;
  activeProviders: string[];
};

type BillingDashboardSummary = {
  billing: BillingProfile;
  invoices: Invoice[];
};

type VaultFile = {
  key: string;
  name: string;
  content_type: string;
  size_bytes: number | null;
  created_at: string;
  include_in_emergency: boolean;
};

const CHECKIN_LABEL: Record<string, string> = {
  monthly: "Monthly",
  weekly: "Weekly",
  daily: "Daily",
};

const ADDON_META: Record<
  string,
  { label: string; description: string; priceLabel?: string; icon: any; comingSoon?: boolean }
> = {
  "call-contacts": {
    label: "Call emergency contacts",
    description: "We’ll call your emergency contacts when triggered",
    priceLabel: "+$1.99/mo",
    icon: Phone,
    comingSoon: true,
  },
  "text-contacts": {
    label: "Text emergency contacts",
    description: "We’ll send SMS to your emergency contacts",
    priceLabel: "+$0.49/mo",
    icon: MessageSquare,
    comingSoon: true,
  },
  "log-location": {
    label: "Log location at check-in",
    description: "Record your GPS location each time you check in",
    priceLabel: "+$0.99/mo",
    icon: MapPin,
    comingSoon: true,
  },
};

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

function formatMoney(amountCents: number, currency: string) {
  const n = Number(amountCents);
  if (!Number.isFinite(n)) return "—";
  const dollars = n / 100;
  const cur = String(currency || "usd").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(dollars);
  } catch {
    return `$${dollars.toFixed(2)}`;
  }
}

function statusBadge(status: BillingStatus) {
  if (status === "active") return { label: "Active", variant: "default" as const };
  if (status === "trial") return { label: "Trial", variant: "secondary" as const };
  if (status === "past_due") return { label: "Past due", variant: "destructive" as const };
  if (status === "paused") return { label: "Paused", variant: "secondary" as const };
  return { label: "Free", variant: "secondary" as const };
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

function normalizeSummary(data: any): BillingDashboardSummary {
  const raw = data || {};
  const billingRaw = raw.billing || raw.profile || raw.subscription || {};
  const addons = Array.isArray(billingRaw.addons) ? billingRaw.addons.map(String) : [];

  return {
    billing: {
      userId: String(billingRaw.userId || "me"),
      status: (billingRaw.status || "pending_setup") as BillingStatus,
      billingInterval: (billingRaw.billingInterval || "monthly") as any,
      amountCents: Number(billingRaw.amountCents ?? 0),
      currency: String(billingRaw.currency || "usd").toLowerCase(),
      storageLimitGb: Number(billingRaw.storageLimitGb ?? 5),
      checkInFrequency: (billingRaw.checkInFrequency || "monthly") as any,
      addons,
      updatedAt: billingRaw.updatedAt ? String(billingRaw.updatedAt) : undefined,
      currentPeriodEnd: billingRaw.currentPeriodEnd ? String(billingRaw.currentPeriodEnd) : null,
      activeProviders: Array.isArray(billingRaw.activeProviders) ? billingRaw.activeProviders.map(String) : [],
    },
    invoices: Array.isArray(raw.invoices) ? raw.invoices : [],
  };
}

function buildFreeSummary(): BillingDashboardSummary {
  return {
    billing: {
      userId: "me",
      status: "pending_setup",
      billingInterval: "monthly",
      amountCents: 0,
      currency: "usd",
      storageLimitGb: 5,
      checkInFrequency: "monthly",
      addons: [],
      updatedAt: undefined,
      currentPeriodEnd: null,
      activeProviders: [],
    },
    invoices: [],
  };
}

export function BillingPage() {
  const { toast } = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<BillingDashboardSummary | null>(null);
  const [isFreeLimited, setIsFreeLimited] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const [vaultUsedBytes, setVaultUsedBytes] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setIsFreeLimited(false);

      try {
        const res = await fetchJson("/auth/billing/summary?limit=50");
        if (!alive) return;
        const normalized = normalizeSummary(res);

        const s = String(normalized?.billing?.status || "");
        const paid = s === "active" || s === "trial";
        if (!paid) setIsFreeLimited(true);

        setSummary(normalized);

        // Storage used from Vault list (authoritative)
        try {
          const out = await fetchJson("/files/list", { method: "GET" });
          if (!alive) return;
          const files: VaultFile[] = Array.isArray(out?.files) ? out.files : [];
          const used = files.reduce((sum, f) => {
            const b = Number(f?.size_bytes);
            return sum + (Number.isFinite(b) && b > 0 ? b : 0);
          }, 0);
          setVaultUsedBytes(used);
        } catch {
          if (!alive) return;
          setVaultUsedBytes(null);
        }
      } catch (e: any) {
        if (!alive) return;

        const code = String(e?.message || "server_error");
        if (e?.status === 401 || code === "not_authenticated") {
          toast({
            title: "Session expired",
            description: "Please log in again.",
            variant: "destructive",
          });
          setSummary(null);
        } else if (e?.status === 402 || code === "payment_required") {
          setIsFreeLimited(true);
          setSummary(buildFreeSummary());
        } else {
          setIsFreeLimited(true);
          setSummary(buildFreeSummary());
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

  const billing = summary?.billing;
  const isPaid = String(billing?.status || "") === "active" || String(billing?.status || "") === "trial";
  const isAppleBilled = Boolean(billing?.activeProviders?.includes("apple") && !billing?.activeProviders?.includes("stripe"));

  async function openBillingPortal() {
    if (portalLoading) return;
    setPortalLoading(true);
    try {
      const r = await fetchJson("/auth/billing/portal", { method: "POST" });
      const url = r?.url ? String(r.url) : "";
      if (!url) throw new Error("portal_url_missing");
      window.location.assign(url);
    } catch (e: any) {
      const msg = String(e?.message || "server_error");
      toast({
        title: "Couldn’t open billing",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setPortalLoading(false);
    }
  }

  const storageUsedBytes =
    vaultUsedBytes !== null && Number.isFinite(vaultUsedBytes) ? Number(vaultUsedBytes) : null;

  const storageLimitGb = Number(billing?.storageLimitGb || 0);
  const storageLimitBytes = storageLimitGb > 0 ? storageLimitGb * 1024 * 1024 * 1024 : 0;

  const hasStorage =
    storageUsedBytes !== null && Number.isFinite(storageLimitBytes) && storageLimitBytes > 0;
  const storagePercentage = hasStorage ? Math.min(100, (Number(storageUsedBytes) / storageLimitBytes) * 100) : 0;

  const badge = useMemo(() => (billing ? statusBadge(billing.status) : null), [billing]);
  const invoices = summary?.invoices || [];

  const knownAddons = useMemo(() => {
    const list = (billing?.addons || []).map((id) => ({ id, meta: ADDON_META[id] }));
    return list;
  }, [billing]);

  const unknownAddons = useMemo(() => {
    const ids = billing?.addons || [];
    return ids.filter((id) => !ADDON_META[id]);
  }, [billing]);

  const checkInLabel = billing ? (CHECKIN_LABEL[billing.checkInFrequency] || billing.checkInFrequency) : "—";

  const lastPaid = useMemo(() => {
    const paid = invoices.find((i) => i.status === "paid");
    return paid?.date ? String(paid.date) : "";
  }, [invoices]);

  const nextCharge = billing?.currentPeriodEnd ? String(billing.currentPeriodEnd) : "";

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Billing</h1>
        <p className="text-muted-foreground">Your custom configuration, current usage, and invoices</p>
      </div>

      {isFreeLimited && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium text-foreground">You’re on a Free plan</div>
                <div className="text-muted-foreground mt-1">Billing details are limited until you build a plan.</div>
                <div className="mt-3 flex gap-2">
                  <Link to="/app/plan">
                    <Button size="sm">Start building my plan</Button>
                  </Link>
                  <Link to="/pricing">
                    <Button size="sm" variant="outline">
                      View pricing
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Your Configuration
              {badge ? <Badge variant={badge.variant}>{badge.label}</Badge> : <Badge variant="secondary">—</Badge>}
            </CardTitle>
            <CardDescription>What your account is configured to include</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading billing…
              </div>
            ) : !billing ? (
              <div className="text-sm text-muted-foreground">No billing profile found.</div>
            ) : (
              <>
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Current total</div>
                    <div className="text-3xl font-bold">
                      {formatMoney(billing.amountCents, billing.currency)}
                      <span className="text-base font-normal text-muted-foreground">
                        /{billing.billingInterval === "annual" ? "yr" : "mo"}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Last updated</div>
                    <div className="text-sm">{billing.updatedAt ? formatDate(billing.updatedAt) : "—"}</div>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">Storage limit</div>
                        <div className="text-xs text-muted-foreground">Included storage for your account</div>
                      </div>
                    </div>
                    <div className="text-sm font-medium">{Number.isFinite(storageLimitGb) ? `${storageLimitGb} GB` : "—"}</div>
                  </div>

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">Check-in frequency</div>
                        <div className="text-xs text-muted-foreground">How often you verify you’re okay</div>
                      </div>
                    </div>
                    <div className="text-sm font-medium">{checkInLabel}</div>
                  </div>

                  <div className="pt-2 border-t">
                    <div className="text-sm font-medium mb-2">Add-ons</div>
                    {billing.addons.length === 0 ? (
                      <div className="text-sm text-muted-foreground">None</div>
                    ) : (
                      <div className="space-y-2">
                        {knownAddons.map(({ id, meta }) => {
                          const Icon = meta?.icon || Zap;
                          return (
                            <div key={id} className="flex items-start justify-between gap-3 p-3 rounded-lg border">
                              <div className="flex items-start gap-2">
                                <Icon className="h-4 w-4 text-muted-foreground mt-0.5" />
                                <div>
                                  <div className="text-sm font-medium">
                                    {meta?.label || id}
                                    {meta?.comingSoon ? (
                                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                        Soon
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="text-xs text-muted-foreground">{meta?.description || "—"}</div>
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground whitespace-nowrap">{meta?.priceLabel || ""}</div>
                            </div>
                          );
                        })}

                        {unknownAddons.length > 0 ? (
                          <div className="text-xs text-muted-foreground">Other: {unknownAddons.join(", ")}</div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="text-sm text-muted-foreground mb-2">
                    {isPaid ? "Want to change your plan or payment details?" : "Want to change what’s included?"}
                  </div>

                  {isPaid ? (
                    <Button asChild variant="outline" className="w-full">
                      <Link to="/app/edit-plan?returnTo=/app/billing">Edit your plan</Link>
                    </Button>
                  ) : (
                    <Button asChild variant="outline" className="w-full">
                      <Link to="/app/plan">Start building my plan</Link>
                    </Button>
                  )}
                </div>
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
                <span>{storageUsedBytes !== null ? `${formatBytes(storageUsedBytes)} used` : "—"}</span>
                <span className="text-muted-foreground">
                  {storageLimitBytes > 0 ? `${formatBytes(storageLimitBytes)} limit` : "Storage limit not available yet."}
                </span>
              </div>
              <Progress value={storagePercentage} className="h-3" />
              <p className="text-xs text-muted-foreground">
                {hasStorage
                  ? `${storagePercentage.toFixed(1)}% of your storage is used`
                  : storageUsedBytes !== null
                    ? "Storage used is shown from your Vault. Limit will appear once billing limit is wired."
                    : "Storage usage will show here once wired."}
              </p>
            </div>

            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">{isPaid ? "Need to change storage?" : "Need more storage?"}</p>

              {isPaid ? (
                <Button asChild variant="secondary" size="sm">
                  <Link to="/app/edit-plan?returnTo=/app/billing">Edit your plan</Link>
                </Button>
              ) : (
                <Button asChild variant="secondary" size="sm">
                  <Link to="/app/plan">Start building my plan</Link>
                </Button>
              )}
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
                <p className="font-medium">{isPaid ? (isAppleBilled ? "Managed by Apple" : "Manage in Stripe") : "Not connected yet"}</p>
                <p className="text-sm text-muted-foreground">
                  {isPaid ? (isAppleBilled ? "Update or cancel your subscription in your Apple ID settings" : "Update your card and billing info in the Stripe portal") : "No payment method connected"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAppleBilled ? (
                <Button variant="outline" size="sm" asChild>
                  <a href="https://apps.apple.com/account/subscriptions" target="_blank" rel="noreferrer">Manage subscription</a>
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={openBillingPortal} disabled={!isPaid || portalLoading}>
                    {portalLoading ? "Opening…" : "Update"}
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive" asChild disabled={!isPaid}>
                    <Link to="/app/settings">Cancel subscription</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
          <CardDescription>Your past invoices and payments</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Last payment</div>
              <div className="text-sm font-medium">{lastPaid ? formatDate(lastPaid) : "—"}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Next charge date</div>
              <div className="text-sm font-medium">{nextCharge ? formatDate(nextCharge) : "—"}</div>
            </div>
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : invoices.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              {isFreeLimited ? "No invoices yet. Create a plan to get started." : "No invoices yet."}
            </div>
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
    </div>
  );
}
