import { VaultFileDetails } from "@/components/app/VaultFileDetails";
import { documentPdf, downloadBlob } from "@/lib/vaultExports";
import { DOCUMENT_TYPE, parseDocument, openRecipientNote } from "@/lib/vaultDocuments";
import { ensureUserKeypair } from "@/lib/vaultCrypto";
import { decryptVaultFile } from "@/lib/vaultDownload";
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
import { listVaultFiles, deleteVaultFile, type VaultFile } from "@/lib/uacFilesApi";
import { formatBytes, formatDate } from "@/lib/format";

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

export function VaultPage() {
  const [syncKey, setSyncKey] = useState(false);
  const [detailsFile, setDetailsFile] = useState<VaultFile | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [downloadFile, setDownloadFile] = useState<VaultFile | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [downloading, setDownloading] = useState(false);
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

    if (vaultLocked) {
      setFiles([]);
      setLoading(false);
      return () => { cancelled = true; };
    }

    (async () => {
      try {
        setLoading(true);
        const f = await listVaultFiles();
        if (!cancelled) setFiles(Array.isArray(f) ? f : []);
      } catch (e: unknown) {
        if (cancelled) return;

        const code = String(e instanceof Error ? e.message : "server_error");
        if (code === "payment_required" || code === "http_402") {
          emitPaywall(
            "Vault is limited on Free",
            "Uploading and managing encrypted files requires an active plan. Build your plan to unlock the vault."
          );
          setFiles([]);
          return;
        }
        if (code === "vault_locked") {
          setFiles([]);
          setUnlockModal(true);
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
  }, [toast, vaultLocked, refresh]);

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

    const file = files.find((item) => item.key === fileKey);
    if (file) setDownloadFile(file);
  };

  const handleDecryptDownload = async () => {
    if ((!downloadFile && !syncKey) || !passphrase.trim() || downloading) return;
    setDownloading(true);
    try {
      if (syncKey) {
        await ensureUserKeypair(passphrase.trim());
        setSyncKey(false);
        setPassphrase("");
        toast({ title: "Vault key backed up", description: "Sign in on another device and use this vault passphrase to access your files." });
        return;
      }
      const result = await decryptVaultFile(downloadFile!, passphrase);
      if (downloadFile!.content_type === DOCUMENT_TYPE) {
        const doc = parseDocument(new TextDecoder().decode(result.bytes));
        const note = await openRecipientNote(result.envelope.meta_json?.recipient_note, result.rawKey);
        downloadBlob(await documentPdf(doc, note), result.name);
      } else downloadBlob(result.blob, result.name);
      setDownloadFile(null);
      setPassphrase("");
      toast({ title: "Download started", description: "Your file has been decrypted." });
    } catch (e: unknown) {
      const code = String(e instanceof Error ? e.message : "server_error");
      if (code === "payment_required" || code === "http_402") {
        emitPaywall(
          "Downloads are limited on Free",
          "Downloading from the vault requires an active plan. Build your plan to unlock downloads."
        );
        return;
      }

      toast({
        title: syncKey ? "Key backup failed" : "Download failed",
        description: code === "bad_passphrase"
          ? "Incorrect vault passphrase. Enter the passphrase you used when uploading."
          : code === "missing_vault_key"
          ? "This older vault key has not been backed up yet. Open the vault on the original device and enter its passphrase to enable access on other devices."
          : code === "missing_file_key"
          ? "Unlock this file on the device it was uploaded from once to back up its key, or try the original upload passphrase."
          : e instanceof Error && e.name === "OperationError"
          ? "This file could not be decrypted with this device’s vault key, or the file is damaged."
          : code,
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

const handleDelete = async (fileKey: string) => {
  if (vaultLocked) {
    setUnlockModal(true);
    toast({ title: "Unlock the vault", description: "Enter your safety PIN, then retry the deletion." });
    return;
  }
  if (!confirm("Delete this file? This cannot be undone.")) return;

  try {
    await deleteVaultFile(fileKey);
    setFiles((prev) => prev.filter((f) => f.key !== fileKey));
    setSelected((prev) => prev.filter((k) => k !== fileKey));
    toast({ title: "Deleted", description: "File removed from your vault." });
  } catch (e: unknown) {
    const code = String(e instanceof Error ? e.message : "server_error");
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

      toast({ title: "Invalid PIN", variant: "destructive" });
    } catch (e: unknown) {
      const msg = String(e instanceof Error ? e.message : "unlock_failed");

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
            {vaultLocked ? "Locked" : loading ? "Loading..." : `${files.length} encrypted file${files.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            if (vaultLocked) {
              setUnlockModal(true);
              toast({ title: "Unlock the vault", description: "Enter your safety PIN before accessing the encrypted key backup." });
              return;
            }
            setSyncKey(true);
          }}
        >
          Enable cross-device access
        </Button>
        <Link to="/app/upload">
          <Button className="gap-2">
            <Upload className="h-4 w-4" /> Add to vault
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
            <span className="text-sm">Vault is locked. Enter your PIN to view or access files.</span>
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
                  <button type="button" className="font-medium text-foreground truncate block max-w-full text-left underline-offset-4 hover:underline" onClick={() => setDetailsFile(file)}>{file.name}</button>
                  {file.document_template && <span className="text-xs text-muted-foreground">Created in your vault · </span>}
                  {file.has_recipient_note && <span className="text-xs text-muted-foreground">Recipient note attached</span>}
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
                      <DropdownMenuItem onClick={() => setDetailsFile(file)}><FileText className="mr-2 h-4 w-4" />{file.document_template ? "View or edit document" : "Edit recipient note"}</DropdownMenuItem>
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

      {detailsFile && !vaultLocked && <VaultFileDetails key={detailsFile.key} file={detailsFile} onClose={() => setDetailsFile(null)} onSaved={() => { setDetailsFile(null); setRefresh(n => n + 1); toast({ title: "Changes saved", description: "Your file and recipient note have been updated." }); }} />}

      <Dialog open={!!downloadFile || syncKey} onOpenChange={(open) => {
        if (!open && !downloading) { setDownloadFile(null); setSyncKey(false); setPassphrase(""); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{syncKey ? "Back up your vault key" : "Decrypt and download"}</DialogTitle>
            <DialogDescription>Enter the vault passphrase you used when uploading. Your encrypted key will be backed up for use on your other devices. This passphrase is separate from your login password and PIN. Downloaded files may contain passwords; anyone with access to the download can read them.</DialogDescription>
          </DialogHeader>
          <Input type="password" aria-label="Vault passphrase" placeholder="Vault passphrase"
            value={passphrase} onChange={(e) => setPassphrase(e.target.value)} disabled={downloading}
            onKeyDown={(e) => { if (e.key === "Enter") handleDecryptDownload(); }} />
          <DialogFooter>
            <Button onClick={handleDecryptDownload} disabled={downloading || !passphrase.trim()}>
              {downloading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{syncKey ? "Backing up…" : "Decrypting…"}</> : syncKey ? "Back up key" : "Download"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

