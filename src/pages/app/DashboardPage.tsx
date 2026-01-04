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

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:3001";

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
  if (freq === "daily") return "Daily";
  if (freq === "weekly") return "Weekly";
  return "Monthly";
}

export function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<VerificationSettings | null>(null);
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);

  const displayName = useMemo(() => {
    const name = (user as any)?.name ? String((user as any).name) : "";
    if (name.trim()) return name.trim().split(" ")[0];
    const email = (user as any)?.email ? String((user as any).email) : "";
    return email ? email : "there";
  }, [user]);

  const emergencyFileCount = useMemo(() => {
    const s = new Set<string>();
    for (const c of contacts) for (const f of c.assignedFiles || []) s.add(String(f));
    return s.size;
  }, [contacts]);

  const verifiedContacts = useMemo(() => contacts.filter((c) => c.verified).length, [contacts]);

  const storageUsed = (user as any)?.storageUsed;
  const storageLimit = (user as any)?.storageLimit;
  const hasStorage = Number.isFinite(storageUsed) && Number.isFinite(storageLimit) && storageLimit > 0;
  const storagePercent = hasStorage ? (Number(storageUsed) / Number(storageLimit)) * 100 : 0;

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
      try {
        const [settingsRes, statusRes, contactsRes] = await Promise.all([
          fetchJson("/auth/verification-settings"),
          fetchJson("/auth/verification-status"),
          fetchJson("/auth/emergency-contacts"),
        ]);

        if (!alive) return;

        setSettings(settingsRes?.settings || null);
        setStatus(statusRes?.status || null);
        setContacts(Array.isArray(contactsRes?.contacts) ? contactsRes.contacts : []);
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
            title: "Couldn’t load dashboard",
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

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {displayName}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Next Verification */}
        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Next Verification</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
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

        {/* Storage (backend not wired yet, so we show AuthContext values if present) */}
        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Storage Used</CardTitle>
            <HardDrive className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {hasStorage ? `${storageUsed} MB` : "—"}
            </div>
            <Progress value={storagePercent} className="h-1.5 mt-2" />
            <p className="text-xs text-muted-foreground mt-1">{hasStorage ? `of ${storageLimit} MB` : "Billing not wired yet"}</p>
            <Link to="/app/billing" className="block mt-4">
              <Button size="sm" variant="outline" className="w-full gap-1">
                View billing <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Emergency Contacts */}
        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Emergency Contacts</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {loading ? "Loading…" : `${verifiedContacts} verified`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {loading ? "…" : `${contacts.length} total contacts`}
            </p>
            <Link to="/app/emergency-contacts" className="block mt-4">
              <Button size="sm" variant="outline" className="w-full gap-1" disabled={loading}>
                Manage <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Emergency Package (derived from contact assignments) */}
        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Emergency Package</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
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

      {/* Recent Activity (backend not wired yet) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Activity</CardTitle>
          <Link to="/app/activity">
            <Button variant="ghost" size="sm" className="gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Activity feed isn’t connected to the backend yet.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}