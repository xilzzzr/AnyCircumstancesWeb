import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar, Clock, Bell, Shield, Loader2, Save, AlertTriangle, KeyRound } from "lucide-react";

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
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);

  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinResetStep, setPinResetStep] = useState<"password" | "email" | "pins">("password");
  const [pinResetPassword, setPinResetPassword] = useState("");
  const [pinResetCode, setPinResetCode] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newEmergencyPin, setNewEmergencyPin] = useState("");
  const [pinResetChallenge, setPinResetChallenge] = useState("");
  const [pinResetBusy, setPinResetBusy] = useState(false);

  const { toast } = useToast();
  const { lockVault } = useAuth();

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    setLoadingInitial(true);
    setLoadError("");
    (async () => {
      try {
        const options = { credentials: "include" as const, signal: controller.signal };
        const [billingResp, settingsResp] = await Promise.all([
          fetch("/auth/billing/status", options),
          fetch("/auth/verification-settings", options),
        ]);
        const [billing, data] = await Promise.all([
          billingResp.json() as Promise<BillingStatusResp>,
          settingsResp.json() as Promise<SettingsResp>,
        ]);
        if (cancelled) return;
        if (billingResp.status === 401 || settingsResp.status === 401) {
          setLoadError("Your session has expired. Sign in again to view your settings.");
          return;
        }
        if (!billingResp.ok || !settingsResp.ok || !data?.ok || !data.settings) {
          throw new Error("settings_unavailable");
        }
        setIsPaid(billing.status === "active" || billing.status === "trialing");
        const settings = data.settings;
        setFrequency(settings.frequency || "weekly");
        setGracePeriod(Number(settings.gracePeriodHours ?? 24));
        setReminders(String(settings.reminders ?? 3));
      } catch {
        if (!cancelled) setLoadError("We couldn't load your verification settings. Check your connection and try again.");
      } finally {
        window.clearTimeout(timeout);
        if (!cancelled) setLoadingInitial(false);
      }
    })();
    return () => { cancelled = true; controller.abort(); window.clearTimeout(timeout); };
  }, [attempt]);

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

  const resetPinDialog = () => {
    setPinResetStep("password");
    setPinResetPassword("");
    setPinResetCode("");
    setNewPin("");
    setNewEmergencyPin("");
    setPinResetChallenge("");
    setPinResetBusy(false);
  };

  const startPinReset = async () => {
    if (!pinResetPassword || pinResetBusy) return;
    setPinResetBusy(true);
    try {
      const resp = await fetch("/auth/pin-reset/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: pinResetPassword }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.ok) {
        toast({
          title: "Could not verify password",
          description: data?.error === "reauthentication_failed"
            ? "That account password is incorrect."
            : "Could not start the PIN change. Please try again.",
          variant: "destructive",
        });
        return;
      }
      setPinResetChallenge(String(data.challenge || ""));
      setPinResetPassword("");
      setPinResetStep("email");
      toast({ title: "Verification code sent", description: "Check your account email for a 6-digit code." });
    } catch {
      toast({ title: "Network error", description: "Could not start the PIN change.", variant: "destructive" });
    } finally {
      setPinResetBusy(false);
    }
  };

  const verifyPinResetEmail = async () => {
    if (!/^\d{6}$/.test(pinResetCode) || !pinResetChallenge || pinResetBusy) return;
    setPinResetBusy(true);
    try {
      const resp = await fetch("/auth/pin-reset/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ challenge: pinResetChallenge, code: pinResetCode }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.ok) {
        toast({
          title: "Code not accepted",
          description: data?.error === "verification_expired"
            ? "That code expired. Close this window and start again."
            : "Check the code in your email and try again.",
          variant: "destructive",
        });
        return;
      }
      setPinResetCode("");
      setPinResetStep("pins");
    } catch {
      toast({ title: "Network error", description: "Could not verify the code.", variant: "destructive" });
    } finally {
      setPinResetBusy(false);
    }
  };

  const completePinReset = async () => {
    if (pinResetBusy) return;
    if (!/^\d{4,6}$/.test(newPin) || !/^\d{4,6}$/.test(newEmergencyPin)) {
      toast({ title: "Invalid PIN", description: "Both PINs must be 4–6 digits.", variant: "destructive" });
      return;
    }
    if (newPin === newEmergencyPin) {
      toast({ title: "PINs must be different", description: "Your safety PIN and emergency PIN cannot match.", variant: "destructive" });
      return;
    }

    setPinResetBusy(true);
    try {
      const resp = await fetch("/auth/pin-reset/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          challenge: pinResetChallenge,
          pin: newPin,
          emergencyPin: newEmergencyPin,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.ok) {
        toast({
          title: "PIN change failed",
          description: data?.error === "verification_expired"
            ? "Your verification expired. Start the process again."
            : data?.error === "pin_conflict"
            ? "Your safety PIN and emergency PIN must be different."
            : "Please start the PIN change again.",
          variant: "destructive",
        });
        return;
      }

      lockVault();
      setPinDialogOpen(false);
      resetPinDialog();
      toast({
        title: "PINs changed",
        description: "Your safety PIN and emergency PIN have both been updated.",
      });
    } catch {
      toast({ title: "Network error", description: "Could not save your new PINs.", variant: "destructive" });
    } finally {
      setPinResetBusy(false);
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
      <div className="mx-auto p-6 lg:p-8 space-y-6 max-w-3xl" role="status">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading settings...
        </div>
      </div>
    );
  }

  if (loadError) return (
    <section className="mx-auto max-w-3xl p-6 lg:p-8" aria-labelledby="settings-error-heading">
      <Card className="editorial-card">
        <CardHeader><CardTitle id="settings-error-heading">Verification settings</CardTitle><CardDescription role="alert">{loadError}</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={() => setAttempt(value => value + 1)}>Try again</Button>
          <Button asChild variant="outline"><Link to="/login">Sign in</Link></Button>
          <Button asChild variant="ghost"><Link to="/onboarding">Back to setup</Link></Button>
        </CardContent>
      </Card>
    </section>
  );

  return (
    <div className="mx-auto p-6 lg:p-8 space-y-6 max-w-3xl">
      <div>
        <Link to="/onboarding" className="mb-4 inline-block text-sm text-primary hover:underline">← Back to setup guide</Link>
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
            <KeyRound className="h-5 w-5 text-primary" />
            Security PINs
          </CardTitle>
          <CardDescription>
            Change your safety PIN and emergency PIN together. For security, you’ll verify your account password and email first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              resetPinDialog();
              setPinDialogOpen(true);
            }}
          >
            Change PIN
          </Button>
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

      <Dialog
        open={pinDialogOpen}
        onOpenChange={(open) => {
          if (pinResetBusy) return;
          setPinDialogOpen(open);
          if (!open) resetPinDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change PINs</DialogTitle>
            <DialogDescription>
              {pinResetStep === "password"
                ? "First, confirm your account password."
                : pinResetStep === "email"
                ? "Enter the 6-digit code we sent to your account email."
                : "Set a new safety PIN and a different emergency PIN."}
            </DialogDescription>
          </DialogHeader>

          {pinResetStep === "password" && (
            <div className="space-y-3">
              <Label htmlFor="pin-reset-password">Account password</Label>
              <Input
                id="pin-reset-password"
                type="password"
                autoComplete="current-password"
                value={pinResetPassword}
                onChange={(e) => setPinResetPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") startPinReset(); }}
              />
            </div>
          )}

          {pinResetStep === "email" && (
            <div className="space-y-3">
              <Label htmlFor="pin-reset-code">Email verification code</Label>
              <Input
                id="pin-reset-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={pinResetCode}
                onChange={(e) => setPinResetCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-digit code"
                onKeyDown={(e) => { if (e.key === "Enter") verifyPinResetEmail(); }}
              />
              <p className="text-xs text-muted-foreground">The code expires after 10 minutes.</p>
            </div>
          )}

          {pinResetStep === "pins" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-safety-pin">New safety PIN</Label>
                <Input
                  id="new-safety-pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="4–6 digits"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-emergency-pin">New emergency PIN</Label>
                <Input
                  id="new-emergency-pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={newEmergencyPin}
                  onChange={(e) => setNewEmergencyPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="4–6 digits"
                />
                <p className="text-xs text-muted-foreground">
                  Your emergency PIN must be different from your safety PIN.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPinDialogOpen(false)}
              disabled={pinResetBusy}
            >
              Cancel
            </Button>
            {pinResetStep === "password" && (
              <Button onClick={startPinReset} disabled={pinResetBusy || !pinResetPassword}>
                {pinResetBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify password"}
              </Button>
            )}
            {pinResetStep === "email" && (
              <Button onClick={verifyPinResetEmail} disabled={pinResetBusy || !/^\d{6}$/.test(pinResetCode)}>
                {pinResetBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify email"}
              </Button>
            )}
            {pinResetStep === "pins" && (
              <Button
                onClick={completePinReset}
                disabled={pinResetBusy || !/^\d{4,6}$/.test(newPin) || !/^\d{4,6}$/.test(newEmergencyPin)}
              >
                {pinResetBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save both PINs"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="border-t border-border pt-6">
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
