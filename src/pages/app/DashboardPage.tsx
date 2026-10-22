import { dashboardPlanState, type DashboardPlanState } from "@/lib/dashboardPlan";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Clock,
  HardDrive,
  Users,
  ArrowRight,
  CheckCircle2,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { computePlanPrice, formatMoney } from "@/lib/pricing";

function paywallDescriptionForDefaultPlan() {
  const p = computePlanPrice({
    storageGb: 5,
    addons: [],
    checkInFrequency: "monthly",
    billingInterval: "monthly",
  });

  const annual = computePlanPrice({
    storageGb: 5,
    addons: [],
    checkInFrequency: "monthly",
    billingInterval: "annual",
  });

  return [
    `Default plan (editable on Pricing):`,
    `• Storage: ${formatMoney(p.storage)}/mo (5 GB)`,
    `• Check-ins: ${formatMoney(p.frequency)}/mo (Monthly)`,
    `• Add-ons: ${formatMoney(p.addons)}/mo`,
    ``,
    `Total: ${formatMoney(p.monthlyTotal)}/mo`,
    `Annual: ${formatMoney(annual.annualTotal ?? p.monthlyTotal * 10)} once per year (pay 10 months, get 2 free)`,
  ].join("\n");
}

type Frequency = "daily" | "weekly" | "monthly";

type VerificationSettings = {
  frequency: Frequency;
  gracePeriodHours: number;
  reminders: number;
  lastCheckinAt: string | null;
  nextDueAt: string | null;
};

type VerificationStatus = {
  state: "not_configured" | "ok" | "overdue" | "expired";
  nextDueAt: string | null;
  graceEndsAt: string | null;
};

type EmergencyContact = {
  id: string;
  name: string;
  email: string;
  relationship: string;
  verified: boolean;
  assignedFiles: string[];
  addedAt: string;
};

type BillingStatusResp = {
  ok?: boolean;
  status?: string;
};

type BillingSummaryResp = {
  ok?: boolean;
  billing?: {
    storageLimitGb?: number | null;
  };
  profile?: {
    storageLimitGb?: number | null;
  };
  subscription?: {
    storageLimitGb?: number | null;
  };
};

type CheckinRow = {
  id: string;
  checkedInAt: string;
  method: "manual" | "email_link";
};

type VaultFile = {
  key: string;
  name: string;
  content_type: string;
  size_bytes: number | null;
  created_at: string;
  include_in_emergency: boolean;
};

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL ?? "";

function formatRelativeTime(targetIso: string) {
  const now = Date.now();
  const target = new Date(targetIso).getTime();
  if (Number.isNaN(target)) return "—";

  const diffMs = target - now;
  const abs = Math.abs(diffMs);

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  const d = Math.floor(abs / day);
  const h = Math.floor((abs % day) / hour);
  const m = Math.floor((abs % hour) / minute);

  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (!d && !h) parts.push(`${Math.max(1, m)}m`);

  return diffMs >= 0 ? `in ${parts.join(" ")}` : `${parts.join(" ")} ago`;
}

function formatFrequencyLabel(freq: Frequency) {
  if (freq === "daily") return "Daily / scheduled";
  if (freq === "weekly") return "Weekly";
  return "Monthly";
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${Math.round((bytes / 1024) * 10) / 10} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
  return `${Math.round((bytes / (1024 * 1024 * 1024)) * 10) / 10} GB`;
}

export function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<VerificationSettings | null>(null);
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [billingSummary, setBillingSummary] = useState<BillingSummaryResp | null>(null);
  const [checkins, setCheckins] = useState<CheckinRow[]>([]);

  const [vaultUsedBytes, setVaultUsedBytes] = useState<number | null>(null);

  const [planState, setPlanState] = useState<DashboardPlanState | null>(null);
  const [billingError, setBillingError] = useState(false);
  const [reload, setReload] = useState(0);

  const displayName = useMemo(() => {
    const name = (user as any)?.name ? String((user as any).name) : "";
    if (name.trim()) return name.trim().split(" ")[0];
    const email = (user as any)?.email ? String((user as any)?.email) : "";
    return email ? email : "there";
  }, [user]);

  const emergencyFileCount = useMemo(() => {
    const s = new Set<string>();
    for (const c of contacts) for (const f of c.assignedFiles || []) s.add(String(f));
    return s.size;
  }, [contacts]);

  const verifiedContacts = useMemo(() => contacts.filter((c) => c.verified).length, [contacts]);

  const storageLimitGbFromSummary = useMemo(() => {
    const s: any = billingSummary || {};
    const raw =
      s?.billing?.storageLimitGb ??
      s?.profile?.storageLimitGb ??
      s?.subscription?.storageLimitGb ??
      null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [billingSummary]);

  const vaultLimitBytes = storageLimitGbFromSummary === null
    ? null : Math.round(storageLimitGbFromSummary * 1024 * 1024 * 1024);
  const hasVaultLimit = vaultLimitBytes !== null && Number.isFinite(vaultLimitBytes) && vaultLimitBytes > 0;
  const hasVaultUsed = vaultUsedBytes !== null && Number.isFinite(vaultUsedBytes) && vaultUsedBytes >= 0;

  const storagePercent = useMemo(() => {
    if (!hasVaultUsed || !hasVaultLimit) return 0;
    return (Number(vaultUsedBytes) / Number(vaultLimitBytes)) * 100;
  }, [hasVaultUsed, hasVaultLimit, vaultUsedBytes, vaultLimitBytes]);

  useEffect(() => {
    let alive = true;

    async function fetchJson(path: string) {
      const r = await fetch(`${API_BASE}${path}`, { credentials: "include" });
      if (!r.ok) {
        const body = await r.json().catch(() => null);
        const err = new Error(body?.error || `http_${r.status}`);
        (err as any).status = r.status;
        throw err;
      }
      return r.json();
    }

    async function load() {
      setLoading(true);
      setBillingError(false);

      try {
        try {
          const billing: BillingStatusResp = await fetchJson("/auth/billing/status");
          if (!alive) return;
          setPlanState(dashboardPlanState(billing));
        } catch (e: any) {
          if (!alive) return;
          setBillingError(true);
          if (e?.status === 401 || e?.message === "not_authenticated") throw e;
        }

        try {
          const summaryRes: BillingSummaryResp = await fetchJson("/auth/billing/summary?limit=1");
          if (!alive) return;
          setBillingSummary(summaryRes || null);
        } catch (e: any) {
          if (!alive) return;
          const code = String(e?.message || "");
          const http = (e as any)?.status;
          if (http === 401 || code === "not_authenticated") throw e;
          setBillingSummary(null);
        }

        try {
          const out = await fetchJson("/files/list");
          if (!alive) return;
          const files: VaultFile[] = Array.isArray(out?.files) ? out.files : [];
          const used = files.reduce((sum, f) => {
            const b = Number(f?.size_bytes);
            return sum + (Number.isFinite(b) && b > 0 ? b : 0);
          }, 0);
          setVaultUsedBytes(used);

        } catch (e: any) {
          if (!alive) return;
          const code = String(e?.message || "");
          const http = (e as any)?.status;
          if (http === 401 || code === "not_authenticated") throw e;
          setVaultUsedBytes(null);
        }

        try {
          const out = await fetchJson("/auth/verification-checkins?limit=5");
          if (!alive) return;
          setCheckins(Array.isArray(out?.checkins) ? out.checkins : []);
        } catch (e: any) {
          if (!alive) return;
          const code = String(e?.message || "");
          const http = (e as any)?.status;
          if (http === 401 || code === "not_authenticated") throw e;
          setCheckins([]);
        }

        try {
          const settingsRes = await fetchJson("/auth/verification-settings");
          if (!alive) return;
          setSettings(settingsRes?.settings || null);
        } catch (e: any) {
          if (!alive) return;
          const code = String(e?.message || "");
          const http = (e as any)?.status;
          if (http === 401 || code === "not_authenticated") throw e;
          setSettings(null);
        }

        try {
          const statusRes = await fetchJson("/auth/verification-status");
          if (!alive) return;
          setStatus(statusRes?.status || null);
        } catch (e: any) {
          if (!alive) return;
          const code = String(e?.message || "");
          const http = (e as any)?.status;
          if (http === 401 || code === "not_authenticated") throw e;
          setStatus(null);
        }

        try {
          const contactsRes = await fetchJson("/auth/emergency-contacts");
          if (!alive) return;
          setContacts(Array.isArray(contactsRes?.contacts) ? contactsRes.contacts : []);
        } catch (e: any) {
          if (!alive) return;
          const code = String(e?.message || "");
          const http = (e as any)?.status;
          if (http === 401 || code === "not_authenticated") throw e;
          setContacts([]);
        }
      } catch (e: any) {
        if (!alive) return;

        const code = String(e?.message || "server_error");
        if ((e as any)?.status === 401 || code === "not_authenticated") {
          toast({
            title: "Session expired",
            description: "Please log in again.",
            variant: "destructive",
          });
        } else {
          toast({ title: "Could not load dashboard", description: "Please try again.", variant: "destructive" });
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

  const nextVerificationText = useMemo(() => {
    if (!status || status.state === "not_configured" || !status.nextDueAt) return "Not set";
    if (status.state === "ok") return formatRelativeTime(status.nextDueAt);
    if (status.state === "overdue") return `Overdue (${formatRelativeTime(status.nextDueAt)})`;
    return "Expired";
  }, [status]);

  const scheduleText = useMemo(() => {
    if (!settings) return "—";
    return formatFrequencyLabel(settings.frequency);
  }, [settings]);

  const statusBadge = useMemo(() => {
    if (!status) return null;

    if (status.state === "expired") {
      return (
        <div className="flex items-center gap-2 text-xs text-destructive mt-2">
          <AlertTriangle className="h-4 w-4" />
          Grace period ended
        </div>
      );
    }

    if (status.state === "overdue") {
      return (
        <div className="flex items-center gap-2 text-xs text-warning mt-2">
          <AlertTriangle className="h-4 w-4" />
          Check-in overdue
        </div>
      );
    }

    if (status.state === "ok") {
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          On track
        </div>
      );
    }

    return null;
  }, [status]);

  const recentActivityRows = useMemo(() => {
    return Array.isArray(checkins) ? checkins.slice(0, 5) : [];
  }, [checkins]);

  return (
    <div className="dashboard-editorial px-5 py-8 lg:px-10 lg:py-12">
      <div className="dashboard-intro">
        <div className="micro-label"><span className="status-dot" /> PERSONAL SECURITY SYSTEM · ONLINE</div>
        <h1>Everything important,<br /><span>held in readiness.</span></h1>
        <p>Welcome back, {displayName}. Your vault, verification schedule, and emergency network are standing by.</p>
        <Link to="/onboarding" className="mt-4 inline-flex min-h-11 items-center text-sm text-primary hover:underline">Continue your setup →</Link>
      </div>

      {billingError && (
        <Card className="editorial-card">
          <CardContent className="py-4 text-sm" role="status">
            <p>We couldn’t verify your plan right now. Please try again.</p>
            <Button className="mt-3" size="sm" variant="outline" disabled={loading} onClick={() => setReload((value) => value + 1)}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {!billingError && planState === "inactive" && (
        <Card className="editorial-card">
          <CardContent className="py-4 text-sm">
            <p>Your subscription needs attention.</p>
            <Link to="/app/billing" className="inline-block mt-3"><Button size="sm" variant="outline">View billing</Button></Link>
          </CardContent>
        </Card>
      )}

      {!billingError && planState === "free" && (
        <Card className="editorial-card free-plan-card">
          <CardContent className="py-4 text-sm">
            <div className="font-medium text-foreground">You’re on a Free plan</div>
            <div className="text-muted-foreground mt-1">
              Dashboard functionality is limited. Build a plan to unlock full features.
            </div>
            <div className="mt-3 flex gap-2">
              <Link to="/app/plan">
                <Button size="sm">Build a plan</Button>
              </Link>
              <Link to="/pricing">
                <Button size="sm" variant="outline">
                  View pricing
                </Button>
              </Link>
            </div>
            <pre className="mt-3 text-xs text-muted-foreground whitespace-pre-wrap">{paywallDescriptionForDefaultPlan()}</pre>
          </CardContent>
        </Card>
      )}

      <div className="editorial-grid">
        <Card className="editorial-card verification-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="micro-label">NEXT VERIFICATION</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="editorial-value">
              {loading ? "Loading…" : nextVerificationText}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Schedule: {loading ? "…" : scheduleText}</p>
            {statusBadge}
            <div className="flex gap-2 mt-4">
              <Link to="/app/check-in" className="flex-1">
                <Button size="sm" className="w-full" disabled={loading}>
                  Verify now
                </Button>
              </Link>
              <Link to="/app/verification">
                <Button size="sm" variant="outline" disabled={loading}>
                  Edit
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="editorial-card storage-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="micro-label">VAULT CAPACITY</CardTitle>
            <HardDrive className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="editorial-value">
              {loading ? "Loading…" : hasVaultUsed ? formatBytes(vaultUsedBytes as number) : "—"}
            </div>

            <Progress value={hasVaultLimit ? storagePercent : 0} className="h-1.5 mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {hasVaultLimit ? (hasVaultUsed ? `of ${formatBytes(vaultLimitBytes as number)}` : "—") : "—"}
            </p>

            <Link to="/app/billing" className="block mt-4">
              <Button size="sm" variant="outline" className="w-full gap-1">
                View billing <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="editorial-card contacts-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="micro-label">TRUSTED NETWORK</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="editorial-value">
              {loading ? "Loading…" : `${verifiedContacts} verified`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{loading ? "…" : `${contacts.length} total contacts`}</p>
            <Link to="/app/emergency-contacts" className="block mt-4">
              <Button size="sm" variant="outline" className="w-full gap-1" disabled={loading}>
                Manage <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="editorial-card package-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="micro-label">EMERGENCY PACKAGE</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="editorial-value">
              {loading ? "Loading…" : `${emergencyFileCount} files`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Assigned across your contacts</p>
            <Link to="/app/vault" className="block mt-4">
              <Button size="sm" variant="outline" className="w-full gap-1">
                View vault <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card className="editorial-card activity-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div><div className="micro-label">SYSTEM LOG</div><CardTitle className="mt-2">Recent activity</CardTitle></div>
          <Link to="/app/activity">
            <Button variant="ghost" size="sm" className="gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : recentActivityRows.length === 0 ? (
            <div className="text-sm text-muted-foreground">No check-ins recorded yet.</div>
          ) : (
            <div className="space-y-3">
              {recentActivityRows.map((c) => (
                <div key={c.id} className="flex items-start justify-between gap-4">
                  <div className="text-sm text-foreground leading-snug">
                    Check-in completed{c.method ? ` • ${c.method === "manual" ? "PIN" : "Email link"}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {c.checkedInAt ? formatRelativeTime(c.checkedInAt) : "—"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
