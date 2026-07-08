import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import {
  Search,
  Upload,
  Filter,
  MoreHorizontal,
  Download,
  Trash2,
  FileText,
  Image,
  Video,
  Archive,
  Lock,
  Shield,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { listVaultFiles, presignDownload, deleteVaultFile, type VaultFile } from "@/lib/uacFilesApi";
import { formatBytes, formatDate } from "@/lib/mockApi";

const getFileIcon = (type: string) => {
  if (type.startsWith("image/")) return Image;
  if (type.startsWith("video/")) return Video;
  if (type.includes("zip") || type.includes("archive")) return Archive;
  return FileText;
};

function emitPaywall(title?: string, description?: string) {
  const returnTo = window.location.pathname + window.location.search;
  window.dispatchEvent(
    new CustomEvent("uac:paywall", {
      detail: {
        title: title || "Paid feature",
        description: description || "This feature is part of a paid plan. Build your plan to unlock it.",
        returnTo,
      },
    })
  );
}

function readJsonSafe(txt: string) {
  try {
    return txt ? JSON.parse(txt) : null;
  } catch {
    return null;
  }
}

function isPaymentRequired(resp: { status: number }, data: any) {
  const code = data?.error ? String(data.error) : "";
  return resp.status === 402 || code === "payment_required";
}

export function VaultPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [unlockModal, setUnlockModal] = useState(false);
  const [pin, setPin] = useState("");
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);

  const { vaultLocked, unlockVault } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const f = await listVaultFiles();
        if (!cancelled) setFiles(Array.isArray(f) ? f : []);
      } catch (e: any) {
        if (cancelled) return;

        const code = String(e?.message || "server_error");
        if (code === "payment_required" || code === "http_402") {
          emitPaywall(
            "Vault is limited on Free",
            "Uploading and managing encrypted files requires an active plan. Build your plan to unlock the vault."
          );
          setFiles([]);
          return;
        }

        toast({
          title: "Could not load vault",
          description: code,
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [toast]);

  const filteredFiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => (f.name || "").toLowerCase().includes(q));
  }, [files, search]);

  const handleDownload = async (fileKey: string) => {
    if (vaultLocked) {
      setUnlockModal(true);
      return;
    }

    try {
      const url = await presignDownload(fileKey);
      if (!url) throw new Error("no_url");

      const a = document.createElement("a");
      a.href = url;
      a.rel = "noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();

      toast({ title: "Download started", description: "Decrypting + downloading your file." });
    } catch (e: any) {
      const code = String(e?.message || "server_error");
      if (code === "payment_required" || code === "http_402") {
        emitPaywall(
          "Downloads are limited on Free",
          "Downloading from the vault requires an active plan. Build your plan to unlock downloads."
        );
        return;
      }

      toast({
        title: "Download failed",
        description: code,
        variant: "destructive",
      });
    }
  };

const handleDelete = async (fileKey: string) => {
  if (!confirm("Delete this file? This cannot be undone.")) return;

  try {
    await deleteVaultFile(fileKey);
    setFiles((prev) => prev.filter((f) => f.key !== fileKey));
    setSelected((prev) => prev.filter((k) => k !== fileKey));
    toast({ title: "Deleted", description: "File removed from your vault." });
  } catch (e: any) {
    const code = String(e?.message || "server_error");
    if (code === "payment_required" || code === "http_402") {
      emitPaywall(
        "Deleting is limited on Free",
        "Deleting files from the vault requires an active plan. Build your plan to unlock deletion."
      );
      return;
    }
    toast({ title: "Delete failed", description: code, variant: "destructive" });
  }
};

  const handleUnlock = async () => {
    if (!pin.trim()) {
      toast({ title: "Enter PIN", description: "Please enter your vault PIN.", variant: "destructive" });
      return;
    }

    setUnlocking(true);
    try {
      const success = await unlockVault(pin);

      if (success) {
        setUnlockModal(false);
        setPin("");
        toast({ title: "Vault unlocked", description: "You can now download files." });
        return;
      }

      const resp: any = (success as any)?.resp;
      const data: any = (success as any)?.data;

      if (resp && isPaymentRequired(resp, data)) {
        setUnlockModal(false);
        emitPaywall(
          "Unlocking the vault is a paid feature",
          "Build a plan to unlock your vault and download encrypted files."
        );
        return;
      }

      if (resp && resp.status === 401) {
        toast({
          title: "Please log in",
          description: "Your session expired. Log in again to unlock the vault.",
          variant: "destructive",
        });
        return;
      }

      toast({ title: "Invalid PIN", variant: "destructive" });
    } catch (e: any) {
      const msg = String(e?.message || "unlock_failed");

      const m = msg.match(/http_(\d+)/);
      const status = m ? Number(m[1]) : 0;

      if (status === 402) {
        setUnlockModal(false);
        emitPaywall(
          "Unlocking the vault is a paid feature",
          "Build a plan to unlock your vault and download encrypted files."
        );
        return;
      }

      toast({ title: "Unlock failed", description: msg, variant: "destructive" });
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vault</h1>
          <p className="text-muted-foreground">
            {loading ? "Loading..." : `${files.length} encrypted file${files.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Link to="/app/upload">
          <Button className="gap-2">
            <Upload className="h-4 w-4" /> Upload files
          </Button>
        </Link>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon" disabled>
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {vaultLocked && (
        <Card className="bg-warning/5 border-warning/20">
          <CardContent className="flex items-center gap-3 py-3">
            <Lock className="h-5 w-5 text-warning" />
            <span className="text-sm">Vault is locked. Enter your PIN to download files.</span>
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => setUnlockModal(true)}>
              Unlock
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {!loading && filteredFiles.length === 0 && (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">No files found.</CardContent>
          </Card>
        )}

        {filteredFiles.map((file) => {
          const Icon = getFileIcon(file.content_type || "application/octet-stream");
          return (
            <Card key={file.key} className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-center gap-4 py-3">
                <Checkbox
                  checked={selected.includes(file.key)}
                  onCheckedChange={(checked) => {
                    setSelected(checked ? [...selected, file.key] : selected.filter((id) => id !== file.key));
                  }}
                />
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{file.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{file.size_bytes === null ? "—" : formatBytes(file.size_bytes)}</span>
                    <span>•</span>
                    <span>{formatDate(file.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {file.include_in_emergency && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Shield className="h-3 w-3" /> Emergency
                    </Badge>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleDownload(file.key)}>
                        <Download className="mr-2 h-4 w-4" /> Download
                      </DropdownMenuItem>
			<DropdownMenuItem className="text-destructive" onClick={() => handleDelete(file.key)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={unlockModal} onOpenChange={setUnlockModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unlock Vault</DialogTitle>
            <DialogDescription>Enter your PIN to access encrypted files.</DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            placeholder="Enter PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            disabled={unlocking}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleUnlock();
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnlockModal(false)} disabled={unlocking}>
              Cancel
            </Button>
            <Button onClick={handleUnlock} disabled={unlocking}>
              {unlocking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
