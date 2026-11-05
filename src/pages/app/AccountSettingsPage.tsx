import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Loader2, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

type Action = "cancel" | "delete" | null;

export function AccountSettingsPage() {
  const [action, setAction] = useState<Action>(null);
  const [confirmation, setConfirmation] = useState("");
  const [pin, setPin] = useState("");
  const [working, setWorking] = useState(false);
  const { logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const phrase = action === "delete" ? "DELETE MY ACCOUNT" : "DELETE MY FILES";

  async function submit() {
    if (!action || confirmation !== phrase || !/^\d{4,6}$/.test(pin)) return;
    setWorking(true);
    try {
      const response = await fetch(
        action === "delete" ? "/auth/account" : "/auth/account/cancel-subscription",
        {
          method: action === "delete" ? "DELETE" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmation, pin }),
        }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok) throw new Error(body?.error || "request_failed");

      const completedAction = action;
      const requiresAppleAction = Boolean(body.requiresAppleAction && body.appleManageUrl);

      // Both normal and emergency-PIN outcomes intentionally follow the same
      // browser flow so the emergency PIN cannot be distinguished by an observer.
      await logout();
      navigate("/login", {
        replace: true,
        state: {
          destructiveActionCompleted: completedAction,
          requiresAppleAction,
          appleManageUrl: requiresAppleAction ? body.appleManageUrl : null,
        },
      });
    } catch (error) {
      const code = String((error as Error)?.message || "");
      toast({
        title: "Action could not be completed",
        description:
          code === "invalid_pin"
            ? "That PIN is incorrect. Enter your check-in PIN."
            : code === "rate_limited"
              ? "Too many attempts. Please wait a while and try again."
              : "Please try again. If it keeps failing, email contact@anycircumstances.com.",
        variant: "destructive",
      });
    } finally {
      setWorking(false);
    }
  }

  const openAction = (nextAction: Exclude<Action, null>) => {
    setAction(nextAction);
    setConfirmation("");
    setPin("");
  };

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto space-y-6">
      <div>
        <div className="micro-label">ACCOUNT CONTROL</div>
        <h1 className="text-3xl mt-3">Account settings</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Manage your subscription, stored data, and account.
        </p>
      </div>

      <Card className="editorial-card">
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
          <CardDescription>
            Cancelling ends your plan immediately and permanently deletes every file in your vault.
            Emergency links already sent for those files stop working. This cannot be undone. Apple
            subscriptions must also be cancelled through Apple.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="text-destructive" onClick={() => openAction("cancel")}>
            <XCircle /> Cancel subscription and delete files
          </Button>
        </CardContent>
      </Card>

      <Card className="editorial-card border-destructive/30">
        <CardHeader>
          <CardTitle>Delete account</CardTitle>
          <CardDescription>
            Permanently deletes your vault files, emergency contacts, pending emergency links, settings,
            account, and other associated personal data. Stripe billing is cancelled automatically. Apple
            billing continues until you cancel it through Apple.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => openAction("delete")}>
            <Trash2 /> Delete account permanently
          </Button>
        </CardContent>
      </Card>

      <Dialog open={Boolean(action)} onOpenChange={(open) => !open && !working && setAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle aria-hidden="true" className="text-destructive" />
              {action === "delete" ? "Permanently delete your account?" : "Cancel and delete all vault files?"}
            </DialogTitle>
            <DialogDescription id="destructive-action-help" className="space-y-3 pt-2">
              <span className="block">
                This is immediate and irreversible when confirmed with your check-in PIN. Every encrypted
                vault file and its recovery information will be permanently deleted.
              </span>
              {action === "delete" ? (
                <span className="block">
                  If you subscribed through Apple, deleting your account does not stop Apple billing.
                  Cancel it in your Apple subscription settings before continuing.
                </span>
              ) : (
                <span className="block">
                  If you subscribed through Apple, this does not stop Apple billing. Cancel it in your Apple
                  subscription settings as well.
                </span>
              )}
              <span className="block">
                Enter your check-in PIN (not your account password), then type{" "}
                <strong className="text-foreground">{phrase}</strong> to confirm.
              </span>
            </DialogDescription>
          </DialogHeader>

          <Label htmlFor="destructive-pin">Check-in PIN</Label>
          <Input
            id="destructive-pin"
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
            autoComplete="off"
          />

          <Label htmlFor="destructive-confirmation">Confirmation phrase</Label>
          <Input
            id="destructive-confirmation"
            aria-describedby="destructive-action-help"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={phrase}
            autoComplete="off"
          />

          <DialogFooter>
            <Button variant="outline" disabled={working} onClick={() => setAction(null)}>
              Keep my account
            </Button>
            <Button
              variant="destructive"
              disabled={working || confirmation !== phrase || !/^\d{4,6}$/.test(pin)}
              onClick={submit}
            >
              {working && <Loader2 aria-hidden="true" className="animate-spin" />}
              {action === "delete" ? "Delete permanently" : "Cancel and delete files"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
