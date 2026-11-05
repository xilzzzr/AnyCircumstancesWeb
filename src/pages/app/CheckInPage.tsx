import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  Clock,
  Calendar,
  Shield,
  AlertTriangle,
  Loader2,
  History,
  Bell
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
  state: "ok" | "overdue" | "expired" | "not_configured";
  nextDueAt: string | null;
  graceEndsAt: string | null;
};

type CheckinRow = {
  id: string;
  checkedInAt: string;
  method: "manual" | "email_link";
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getTimeUntil(dateString: string) {
  const now = new Date();
  const target = new Date(dateString);
  const diff = target.getTime() - now.getTime();

  if (diff < 0) return "Overdue";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h remaining`;
  return "Less than 1 hour";
}

function getApiBaseUrl() {
  const v = import.meta.env?.VITE_API_BASE_URL;
  return (typeof v === "string" && v.trim()) ? v.trim() : "";
}

type ApiError = Error & { status?: number; payload?: { error?: string } | null };

async function apiFetch(path: string, init?: RequestInit) {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    }
  });

  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const error = data?.error || data?.message || `http_${res.status}`;
    const e = new Error(error) as ApiError;
    e.status = res.status;
    e.payload = data;
    throw e;
  }

  return data;
}

export function CheckInPage() {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  // True when the check-in happened after the grace period had already ended. Based only on
  // the schedule state loaded before the check-in, never on which PIN was entered.
  const [checkedInAfterGrace, setCheckedInAfterGrace] = useState(false);

  const [settings, setSettings] = useState<VerificationSettings | null>(null);
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [history, setHistory] = useState<CheckinRow[]>([]);

  const { toast } = useToast();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const isOverdue = useMemo(() => {
    if (!status) return false;
    return status.state === "overdue" || status.state === "expired";
  }, [status]);

  const timeRemaining = useMemo(() => {
    if (!status?.nextDueAt) return "";
    return getTimeUntil(status.nextDueAt);
  }, [status?.nextDueAt]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const a = await apiFetch("/auth/verification-settings");
      const b = await apiFetch("/auth/verification-status");

      setSettings(a?.settings || null);
      setStatus(b?.status || null);

      try {
        const c = await apiFetch("/auth/verification-checkins?limit=5", { method: "GET" });
        setHistory(Array.isArray(c?.checkins) ? c.checkins : []);
      } catch {
        setHistory([]);
      }
    } catch (err: unknown) {
      const e = err as ApiError;
      if (e?.status === 401) {
        toast({
          title: "Session expired",
          description: "Please log in again.",
          variant: "destructive"
        });
        navigate("/login");
        return;
      }

      toast({
        title: "Could not load check-in info",
        description: "Try refreshing the page.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVerify = async () => {
    const trimmed = pin.trim();

    if (!/^\d{4,6}$/.test(trimmed)) {
      toast({
        title: "Invalid PIN",
        description: "Enter your 4–6 digit PIN.",
        variant: "destructive"
      });
      return;
    }

    setVerifying(true);
    const graceEndedBefore = status?.state === "expired";
    try {
      await apiFetch("/auth/verification-check-in", {
        method: "POST",
        body: JSON.stringify({ pin: trimmed })
      });

      setCheckedInAfterGrace(graceEndedBefore);
      setVerified(true);
      setPin("");

      toast({
        title: "Check-in complete",
        description: "Your verification has been recorded."
      });

      await loadAll();
    } catch (err: unknown) {
      const e = err as ApiError;
      if (e?.status === 401) {
        setPin("");
        const signOutReason = e?.payload?.error === "invalid_pin" ? "incorrect-check-in-pin" : "session-expired";
        await logout();
        navigate("/login", { replace: true, state: { signOutReason } });
        return;
      }

      toast({
        title: "Could not verify",
        description: "Please try again.",
        variant: "destructive"
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleReset = () => {
    setVerified(false);
    setPin("");
  };

  const scheduleFrequency = settings?.frequency || "weekly";
  const graceHours = settings?.gracePeriodHours ?? 24;
  const reminders = settings?.reminders ?? 3;

  const headline = verified
    ? "Verified"
    : status?.state === "not_configured"
      ? "Verification Not Configured"
      : isOverdue
        ? "Verification Overdue"
        : "Verification Required";

  const description = verified
    ? `Next check-in due in ${scheduleFrequency === "daily" ? "24 hours" : scheduleFrequency === "weekly" ? "7 days" : "30 days"}`
    : status?.state === "not_configured"
      ? "Set your schedule first in Verification Settings."
      : status?.state === "expired"
        ? "Your grace period has ended, so emergency delivery may already have started. Check in now to restart your schedule."
        : isOverdue
          ? "Please verify now to prevent emergency delivery"
          : (timeRemaining || "");

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Check-in</h1>
        <p className="text-muted-foreground">Verify your status to keep your vault secure</p>
      </div>

      <Card className={verified ? "border-success/50 bg-success/5" : isOverdue ? "border-warning/50 bg-warning/5" : ""}>
        <CardHeader className="text-center pb-2">
          <div
            className={`h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              verified ? "bg-success/10" : isOverdue ? "bg-warning/10" : "bg-primary/10"
            }`}
          >
            {verified ? (
              <CheckCircle2 className="h-8 w-8 text-success" />
            ) : isOverdue ? (
              <AlertTriangle className="h-8 w-8 text-warning" />
            ) : (
              <Shield className="h-8 w-8 text-primary" />
            )}
          </div>
          <CardTitle className="text-xl">{headline}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading...
            </div>
          ) : status?.state === "not_configured" ? (
            <Button className="w-full" size="lg" onClick={() => navigate("/app/verification")}>
              Go to Verification Settings
            </Button>
          ) : !verified ? (
            <>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={pin} onChange={setPin}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button
                className="w-full"
                size="lg"
                disabled={pin.trim().length < 4 || verifying}
                onClick={handleVerify}
              >
                {verifying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Verifying...
                  </>
                ) : (
                  "Verify with PIN"
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Enter your 4–6 digit PIN to confirm you're okay
              </p>
            </>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                {checkedInAfterGrace
                  ? "Your schedule has restarted. Your grace period had already ended, so emergency delivery may have started; emails that were already sent can't be recalled."
                  : "Your emergency contacts will not be notified. See you at your next scheduled check-in."}
              </p>
              <Button variant="outline" onClick={handleReset}>
                Check in again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Schedule</p>
              <p className="font-medium capitalize">{scheduleFrequency}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Grace period</p>
              <p className="font-medium">{graceHours} hours</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Reminders</p>
              <p className="font-medium">{reminders} before delivery</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5" />
            Recent Check-ins
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No check-ins recorded yet.
            </p>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-success" />
                    <span className="text-sm">{formatDate(item.checkedInAt)}</span>
                  </div>
                  <Badge className="bg-success/10 text-success hover:bg-success/20">
                    Completed
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}