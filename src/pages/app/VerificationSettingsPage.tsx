import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, Bell, Shield, Loader2, Save, AlertTriangle } from "lucide-react";

type Frequency = "daily" | "weekly" | "monthly";

type BillingStatusResp = { ok?: boolean; status?: string };
type SettingsResp = {
  ok?: boolean;
  settings?: {
    frequency?: Frequency;
    gracePeriodHours?: number;
    reminders?: number;
  };
  error?: string;
};

function formatFrequencyLabel(freq: Frequency) {
  if (freq === "daily") return "Daily";
  if (freq === "weekly") return "Weekly";
  return "Monthly";
}

function getFrequencyDescription(freq: Frequency) {
  if (freq === "daily") return "You will need to check in every 24 hours.";
  if (freq === "weekly") return "You will need to check in once every 7 days.";
  return "You will need to check in once every 30 days.";
}

export function VerificationSettingsPage() {
  const [frequency, setFrequency] = useState<Frequency>("weekly");
  const [gracePeriod, setGracePeriod] = useState(24);
  const [reminders, setReminders] = useState("3");
  const [saving, setSaving] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);

  const [isPaid, setIsPaid] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [billingResp, settingsResp] = await Promise.all([
          fetch("/auth/billing/status", { method: "GET", credentials: "include" }).catch(() => null),
          fetch("/auth/verification-settings", { method: "GET", credentials: "include" }).catch(() => null),
        ]);

        if (cancelled) return;

        if (billingResp) {
          const billing = (await billingResp.json().catch(() => null)) as BillingStatusResp | null;
          const s = String(billing?.status || "");
          setIsPaid(s === "active" || s === "trialing");
        } else {
          setIsPaid(false);
        }

        if (!settingsResp) {
          toast({
            title: "Could not load settings",
            description: "You are on a Free plan therefore some functionality is limited.",
            variant: "destructive",
          });
          return;
        }

        const data = (await settingsResp.json().catch(() => null)) as SettingsResp | null;

        if (!settingsResp.ok || !data?.ok) {
          const code = data?.error || "load_failed";
          if (code === "not_authenticated") {
            toast({
              title: "Session expired",
              description: "Please log in again.",
              variant: "destructive",
            });
          } else if (code === "payment_required") {
            setIsPaid(false);
          } else {
            toast({
              title: "Could not load settings",
              description: "You are on a Free plan therefore some functionality is limited.",
            });
          }
          return;
        }

        const s = data.settings;
        if (s) {
          setFrequency((s.frequency as Frequency) || "weekly");
          setGracePeriod(Number(s.gracePeriodHours ?? 24));
          setReminders(String(s.reminders ?? 3));
        }
      } catch {
        if (!cancelled) {
          toast({
            title: "Limited dashboard on Free",
            description: "You are on a Free plan therefore your verification controls are limited.",
          });
          setIsPaid(false);
        }
      } finally {
        if (!cancelled) setLoadingInitial(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [toast]);

  const handleSave = async () => {
    if (!isPaid) {
      toast({
        title: "Paid feature",
        description: "Adjusting grace period and reminders requires an active plan.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const resp = await fetch("/auth/verification-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          gracePeriodHours: gracePeriod,
          reminders: Number(reminders),
        }),
      });

      const data = await resp.json().catch(() => null);

      if (!resp.ok || !data?.ok) {
        const code = data?.error || "save_failed";

        if (code === "not_authenticated") {
          toast({
            title: "Session expired",
            description: "Please log in again.",
            variant: "destructive",
          });
          return;
        }

        if (code === "payment_required") {
          toast({
            title: "Paid feature",
            description: "Adjusting these settings requires an active plan.",
            variant: "destructive",
          });
          setIsPaid(false);
          return;
        }

        toast({
          title: "Save failed",
          description: "Please try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Settings saved",
        description: "Your verification settings have been updated.",
      });
    } catch {
      toast({
        title: "Network error",
        description: "Could not reach the server.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const graceLabel = useMemo(() => {
    if (gracePeriod < 24) return `${gracePeriod} hours`;
    if (gracePeriod === 24) return "1 day";
    if (gracePeriod === 48) return "2 days";
    if (gracePeriod === 72) return "3 days";
    return `${gracePeriod} hours`;
  }, [gracePeriod]);

  if (loadingInitial) {
    return (
      <div className="p-6 lg:p-8 space-y-6 max-w-3xl">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading settings...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 pb-24 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Verification Settings</h1>
        <p className="text-muted-foreground">Configure your grace period and reminder notifications</p>
      </div>

      {!isPaid && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-foreground">Free plan limitations</p>
                <p className="text-muted-foreground mt-1">
                  You can view your schedule, but changing grace period and reminder notifications requires a paid plan.
                </p>
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
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-primary" />
            Check-in Frequency
          </CardTitle>
          <CardDescription>This is based on your plan and can’t be changed here</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <div className="font-medium text-foreground">{formatFrequencyLabel(frequency)}</div>
              <div className="text-sm text-muted-foreground">{getFrequencyDescription(frequency)}</div>
            </div>
            <Link to="/app/plan">
              <Button variant="outline" size="sm">
                Change plan
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-primary" />
            Grace Period
          </CardTitle>
          <CardDescription>How long after a missed check-in before your files are delivered?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Grace period duration</span>
              <span className="font-medium text-primary">{graceLabel}</span>
            </div>
            <Slider
              value={[gracePeriod]}
              onValueChange={(v) => setGracePeriod(v[0])}
              min={6}
              max={72}
              step={6}
              className="w-full"
              disabled={!isPaid || saving}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>6 hours</span>
              <span>72 hours</span>
            </div>

            {!isPaid && (
              <div className="text-xs text-muted-foreground">
                Upgrade to adjust grace period.
              </div>
            )}
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground">Important</p>
              <p className="text-muted-foreground">
                After the grace period expires, your selected files will be automatically sent to your emergency contacts.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5 text-primary" />
            Reminder Notifications
          </CardTitle>
          <CardDescription>How many reminders should we send before delivering your files?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={reminders} onValueChange={setReminders} disabled={!isPaid || saving}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 reminder</SelectItem>
              <SelectItem value="2">2 reminders</SelectItem>
              <SelectItem value="3">3 reminders (Recommended)</SelectItem>
              <SelectItem value="4">4 reminders</SelectItem>
              <SelectItem value="5">5 reminders</SelectItem>
            </SelectContent>
          </Select>

          <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            We'll send {reminders} reminder{parseInt(reminders) > 1 ? "s" : ""} via email and push notification during
            your grace period before any files are delivered.
          </p>

          {!isPaid && (
            <div className="text-xs text-muted-foreground">
              Upgrade to change reminder count.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-t z-40 lg:left-64">
        <div className="max-w-3xl mx-auto flex justify-center">
          {isPaid ? (
            <Button onClick={handleSave} disabled={saving} className="gap-2 shadow-lg">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save settings
                </>
              )}
            </Button>
          ) : (
            <Link to="/app/plan">
              <Button className="gap-2 shadow-lg">
                Build a plan to edit
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
