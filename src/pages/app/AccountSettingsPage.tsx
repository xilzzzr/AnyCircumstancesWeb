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
  const [working, setWorking] = useState(false);
  const { logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const phrase = action === "delete" ? "DELETE MY ACCOUNT" : "DELETE MY FILES";

  async function submit() {
    if (!action || confirmation !== phrase) return;
    setWorking(true);
    try {
      const response = await fetch(action === "delete" ? "/auth/account" : "/auth/account/cancel-subscription", {
        method: action === "delete" ? "DELETE" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok) throw new Error(body?.error || "request_failed");
      if (action === "delete") {
        await logout();
        navigate("/");
        return;
      }
      setAction(null);
      setConfirmation("");
      toast({ title: "Subscription cancelled", description: `${body.deletedFiles || 0} vault files were permanently deleted.` });
      if (body.requiresAppleAction && body.appleManageUrl) window.location.assign(body.appleManageUrl);
    } catch (error) {
      toast({ title: "Action could not be completed", description: String((error as Error)?.message || error), variant: "destructive" });
    } finally { setWorking(false); }
  }

  return <div className="p-6 lg:p-10 max-w-4xl mx-auto space-y-6">
    <div><div className="micro-label">ACCOUNT CONTROL</div><h1 className="text-3xl mt-3">Account settings</h1><p className="text-sm text-muted-foreground mt-2">Manage your subscription, stored data, and account.</p></div>
    <Card className="editorial-card"><CardHeader><CardTitle>Subscription</CardTitle><CardDescription>Cancelling immediately removes access and permanently deletes every file in your vault. This cannot be undone.</CardDescription></CardHeader><CardContent><Button variant="outline" className="text-destructive" onClick={() => { setAction("cancel"); setConfirmation(""); }}><XCircle /> Cancel subscription and delete files</Button></CardContent></Card>
    <Card className="editorial-card border-destructive/30"><CardHeader><CardTitle>Delete account</CardTitle><CardDescription>Permanently deletes your vault files, contacts, settings, account, and other associated personal data. Stripe billing is cancelled automatically. Apple billing continues until you cancel it through Apple.</CardDescription></CardHeader><CardContent><Button variant="destructive" onClick={() => { setAction("delete"); setConfirmation(""); }}><Trash2 /> Delete account permanently</Button></CardContent></Card>
    <Dialog open={Boolean(action)} onOpenChange={(open) => !open && !working && setAction(null)}><DialogContent><DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle aria-hidden="true" className="text-destructive" /> {action === "delete" ? "Permanently delete your account?" : "Cancel and delete all vault files?"}</DialogTitle><DialogDescription id="destructive-action-help" className="space-y-3 pt-2"><span className="block">This is immediate and irreversible. Every encrypted vault file and its recovery information will be permanently deleted.</span>{action === "delete" && <span className="block">If you subscribed through Apple, deleting your account does not stop Apple billing. Cancel it in your Apple subscription settings before continuing.</span>}<span className="block">Type <strong className="text-foreground">{phrase}</strong> to confirm.</span></DialogDescription></DialogHeader><Label htmlFor="destructive-confirmation">Confirmation phrase</Label><Input id="destructive-confirmation" aria-describedby="destructive-action-help" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={phrase} autoComplete="off" /><DialogFooter><Button variant="outline" disabled={working} onClick={() => setAction(null)}>Keep my account</Button><Button variant="destructive" disabled={working || confirmation !== phrase} onClick={submit}>{working && <Loader2 aria-hidden="true" className="animate-spin" />}{action === "delete" ? "Delete permanently" : "Cancel and delete files"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
