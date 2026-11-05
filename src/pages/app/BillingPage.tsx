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
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PlannedFeaturesNote } from "@/components/pricing/PlannedFeaturesNote";
import { formatMoney as formatPlanPrice, getPlanCharge } from "@/lib/pricing";

const API_BASE = import.meta.env?.VITE_API_BASE_URL || "";

type Invoice = {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: "paid" | "pending" | "failed";
  invoiceUrl: string | null;
};

type BillingStatus = "trial" | "active" | "paused" | "past_due" | "unpaid" | "pending_setup";

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

type HttpError = Error & { status?: number };

const CHECKIN_LABEL: Record<string, string> = {
  monthly: "Monthly",
  weekly: "Weekly",
  daily: "Daily / scheduled",
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
  if (status === "past_due" || status === "unpaid") return { label: "Past due", variant: "destructive" as const };
  if (status === "paused") return { label: "Paused", variant: "secondary" as const };
  return { label: "No active plan", variant: "secondary" as const };
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
    const err: HttpError = new Error(body?.error || `http_${r.status}`);
    err.status = r.status;
    throw err;
  }
  return body;
}

function normalizeSummary(data: unknown): BillingDashboardSummary {
  const raw = (data || {}) as Record<string, unknown>;
  const billingRaw = (raw.billing || raw.profile || raw.subscription || {}) as Record<string, unknown>;
  const addons = Array.isArray(billingRaw.addons) ? billingRaw.addons.map(String) : [];

  return {
    billing: {
      userId: String(billingRaw.userId || "me"),
      status: (billingRaw.status || "pending_setup") as BillingStatus,
      billingInterval: billingRaw.billingInterval === "annual" ? "annual" : "monthly",
      amountCents: Number(billingRaw.amountCents ?? 0),
      currency: String(billingRaw.currency || "usd").toLowerCase(),
      storageLimitGb: Number(billingRaw.storageLimitGb ?? 5),
      checkInFrequency: (billingRaw.checkInFrequency || "monthly") as BillingProfile["checkInFrequency"],
      addons,
      updatedAt: billingRaw.updatedAt ? String(billingRaw.updatedAt) : undefined,
      currentPeriodEnd: billingRaw.currentPeriodEnd ? String(billingRaw.currentPeriodEnd) : null,
      activeProviders: Array.isArray(billingRaw.activeProviders) ? billingRaw.activeProviders.map(String) : [],
    },
    invoices: Array.isArray(raw.invoices) ? (raw.invoices as Invoice[]) : [],
  };
}

function buildNoPlanSummary(): BillingDashboardSummary {
  return {
    billing: {
      userId: "me",
      status: "pending_setup",
      billingInterval: "monthly",
      amountCents: 0,
      currency: "usd",
      storageLimitGb: 0,
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

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<BillingDashboardSummary | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);
  const [portalLoading, setPortalLoading] = useState(false);

  const [vaultUsedBytes, setVaultUsedBytes] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setLoadError(false);

      try {
        const res = await fetchJson("/auth/billing/summary?limit=50");
        if (!alive) return;
        setSummary(normalizeSummary(res));

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
      } catch (e) {
        if (!alive) return;

        const err = e as HttpError;
        const code = String(err?.message || "server_error");
        if (err?.status === 401 || code === "not_authenticated") {
          toast({
            title: "Session expired",
            description: "Please log in again.",
            variant: "destructive",
          });
          setSummary(null);
        } else if (err?.status === 402 || code === "payment_required") {
          setSummary(buildNoPlanSummary());
        } else {
          // Unknown plan state: don't claim the account has no plan.
          setSummary(null);
          setLoadError(true);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [toast, reload]);

  const billing = summary?.billing;
  const status = String(billing?.status || "");
  const isPaid = status === "active" || status === "trial";
  const needsAttention = status === "past_due" || status === "unpaid" || status === "paused";
  const hasNoPlan = Boolean(billing) && !isPaid && !needsAttention;
  const isAppleBilled = Boolean(billing?.activeProviders?.includes("apple") && !billing?.activeProviders?.includes("stripe"));
  const canOpenPortal = (isPaid || needsAttention) && !isAppleBilled;

  async function openBillingPortal() {
    if (portalLoading) return;
    setPortalLoading(true);
    try {
      const r = await fetchJson("/auth/billing/portal", { method: "POST" });
      const url = r?.url ? String(r.url) : "";
      if (!url) throw new Error("portal_url_missing");
      window.location.assign(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "server_error";
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

  const storageLimitGb = hasNoPlan ? 0 : Number(billing?.storageLimitGb || 0);
  const storageLimitBytes = storageLimitGb > 0 ? storageLimitGb * 1024 * 1024 * 1024 : 0;

  const hasStorage =
    storageUsedBytes !== null && Number.isFinite(storageLimitBytes) && storageLimitBytes > 0;
  const storagePercentage = hasStorage ? Math.min(100, (Number(storageUsedBytes) / storageLimitBytes) * 100) : 0;

  const badge = useMemo(() => (billing ? statusBadge(billing.status) : null), [billing]);
  const invoices = useMemo(() => summary?.invoices || [], [summary]);

  const checkInLabel = billing ? (CHECKIN_LABEL[billing.checkInFrequency] || billing.checkInFrequency) : "—";

  const lastPaid = useMemo(() => {
    const paid = invoices.find((i) => i.status === "paid");
    return paid?.date ? String(paid.date) : "";
  }, [invoices]);

  const nextCharge = billing?.currentPeriodEnd ? String(billing.currentPeriodEnd) : "";
  const nextChargeLabel = nextCharge ? formatDate(nextCharge) : "";

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Billing</h1>
        <p className="text-muted-foreground">Your plan, current usage, and invoices</p>
      </div>

      {loadError && (
        <Card className="border-destructive/30">
          <CardContent className="py-4 text-sm" role="status">
            <p className="text-foreground">We couldn’t load your billing details right now. Please try again.</p>
            <Button className="mt-3 min-h-11" size="sm" variant="outline" disabled={loading} onClick={() => setReload((value) => value + 1)}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {hasNoPlan && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Shield aria-hidden="true" className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm">
                <h2 className="font-medium text-foreground">No active plan</h2>
                <p className="text-muted-foreground mt-1">
                  Choose a plan to start storing files. Without an active plan you can’t upload, store or download files, or add emergency contacts. There’s no free plan or trial.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild size="sm" className="min-h-11">
                    <Link to="/app/plan">Choose a plan</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="min-h-11">
                    <Link to="/pricing">View pricing</Link>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {needsAttention && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle aria-hidden="true" className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm">
                <h2 className="font-medium text-foreground">Your plan needs attention</h2>
                <p className="text-muted-foreground mt-1">
                  {status === "paused"
                    ? "Your subscription is paused. Review it in the billing portal."
                    : "A payment didn’t go through, so access to your vault is paused. Update your payment details to continue."}
                </p>
                {canOpenPortal && (
                  <Button className="mt-3 min-h-11" size="sm" onClick={openBillingPortal} disabled={portalLoading}>
                    {portalLoading ? "Opening…" : "Update payment details"}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Your Plan
              {badge ? <Badge variant={badge.variant}>{badge.label}</Badge> : <Badge variant="secondary">—</Badge>}
            </CardTitle>
            <CardDescription>What your plan includes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading billing…
              </div>
            ) : !billing ? (
              <div className="text-sm text-muted-foreground">No billing profile found.</div>
            ) : hasNoPlan ? (
              <>
                <p className="text-sm text-muted-foreground">
                  You haven’t chosen a plan yet. Plans start at {formatPlanPrice(getPlanCharge(5, "monthly", "monthly").amount)}/month for 5 GB with monthly check-ins.
                </p>
                <Button asChild variant="outline" className="w-full min-h-11">
                  <Link to="/app/plan">Choose a plan</Link>
                </Button>
              </>
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
                        <div className="text-xs text-muted-foreground">The most your encrypted files can add up to</div>
                      </div>
                    </div>
                    <div className="text-sm font-medium">{Number.isFinite(storageLimitGb) && storageLimitGb > 0 ? `${storageLimitGb} GB` : "—"}</div>
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

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">Billing</div>
                        <div className="text-xs text-muted-foreground">
                          {billing.billingInterval === "annual" ? "Billed once a year, renews yearly" : "Billed monthly, renews monthly"}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm font-medium">{billing.billingInterval === "annual" ? "Annual" : "Monthly"}</div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="text-sm text-muted-foreground mb-2">
                    {isPaid ? "Want to change your plan or payment details?" : "Want to change what’s included?"}
                  </div>

                  {isPaid ? (
                    <Button asChild variant="outline" className="w-full min-h-11">
                      <Link to="/app/edit-plan?returnTo=/app/billing">Edit your plan</Link>
                    </Button>
                  ) : null}
                </div>
              </>
            )}
            <PlannedFeaturesNote />
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
                  {storageLimitBytes > 0 ? `${formatBytes(storageLimitBytes)} limit` : hasNoPlan ? "No storage until you choose a plan" : "Storage limit unavailable"}
                </span>
              </div>
              <Progress value={storagePercentage} className="h-3" aria-label="Storage used" />
              <p className="text-xs text-muted-foreground">
                {hasStorage
                  ? `${storagePercentage.toFixed(1)}% of your storage is used`
                  : hasNoPlan
                    ? "Choose a plan to start storing files."
                    : "Storage usage isn’t available right now."}
              </p>
            </div>

            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">{isPaid ? "Need to change storage?" : hasNoPlan ? "Ready to store files?" : "Need more storage?"}</p>

              {isPaid ? (
                <Button asChild variant="secondary" size="sm" className="min-h-11">
                  <Link to="/app/edit-plan?returnTo=/app/billing">Edit your plan</Link>
                </Button>
              ) : hasNoPlan ? (
                <Button asChild variant="secondary" size="sm" className="min-h-11">
                  <Link to="/app/plan">Choose a plan</Link>
                </Button>
              ) : null}
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">{isPaid || needsAttention ? (isAppleBilled ? "Managed by Apple" : "Manage in Stripe") : "Not connected yet"}</p>
                <p className="text-sm text-muted-foreground">
                  {isPaid || needsAttention ? (isAppleBilled ? "Update or cancel your subscription in your Apple ID settings" : "Update your card and billing info in the Stripe portal") : "No payment method connected"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAppleBilled ? (
                <Button variant="outline" size="sm" className="min-h-11" asChild>
                  <a href="https://apps.apple.com/account/subscriptions" target="_blank" rel="noreferrer">Manage subscription</a>
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" className="min-h-11" onClick={openBillingPortal} disabled={!canOpenPortal || portalLoading}>
                    {portalLoading ? "Opening…" : "Update"}
                  </Button>
                  {isPaid || needsAttention ? (
                    <Button variant="outline" size="sm" className="min-h-11 text-destructive" asChild>
                      <Link to="/app/settings">Cancel subscription</Link>
                    </Button>
                  ) : (
                    // A disabled <a> still navigates; render a real disabled button instead.
                    <Button variant="outline" size="sm" className="min-h-11 text-destructive" disabled>
                      Cancel subscription
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
          {isPaid && !isAppleBilled && (
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Cancelling (from Account settings) ends your plan immediately and permanently deletes your stored files. Payments are non-refundable except where required by law — see{" "}
              <Link to="/terms" className="text-primary underline underline-offset-4">Terms</Link>.
            </p>
          )}
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
            {nextChargeLabel && nextChargeLabel !== "—" && (
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Next charge date</div>
                <div className="text-sm font-medium">{nextChargeLabel}</div>
              </div>
            )}
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : invoices.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              {hasNoPlan ? "No invoices yet. Choose a plan to get started." : "No invoices yet."}
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
                        <Button variant="ghost" size="sm" asChild>
                          <a href={invoice.invoiceUrl} target="_blank" rel="noreferrer" aria-label={`Download invoice from ${formatDate(invoice.date)}`}>
                            <Download aria-hidden="true" className="h-4 w-4" />
                          </a>
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" disabled aria-label="Invoice not available">
                          <Download aria-hidden="true" className="h-4 w-4" />
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
