import React, { useState, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, X, FileText, Check, Loader2, Shield, Lock, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { encryptFileToAesGcm, ensureUserKeypair, wrapAesKeyForUser } from "@/lib/vaultCrypto";

async function saveEscrowForFile(fileId: string, rawAesKey: Uint8Array) {
  const pubRes = await fetch("/files/escrow-public-key", { credentials: "include" });
  const pubJson = await pubRes.json();
  if (!pubRes.ok || !pubJson?.ok || !pubJson?.public_key_pem) {
    throw new Error("escrow_public_key_unavailable");
  }

  const pem: string = String(pubJson.public_key_pem);
  const b64 = pem.replace(/-----BEGIN PUBLIC KEY-----/g, "")
    .replace(/-----END PUBLIC KEY-----/g, "")
    .replace(/\s+/g, "");

  const spkiDer = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;

  const pubKey = await crypto.subtle.importKey(
    "spki",
    spkiDer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );

  const wrapped = new Uint8Array(await crypto.subtle.encrypt({ name: "RSA-OAEP" }, pubKey, rawAesKey));

  const wrappedB64 = btoa(String.fromCharCode(...wrapped));

  const saveRes = await fetch("/files/save-file-escrow", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      file_id: fileId,
      alg: "rsa-oaep-sha256",
      enc_key_b64: wrappedB64,
    }),
  });

  const saveJson = await saveRes.json().catch(() => ({}));
  if (!saveRes.ok || !saveJson?.ok) {
    throw new Error(saveJson?.error || "save_file_escrow_failed");
  }
}


type UploadingFile = {
  id: string;
  file: File;
  progress: number;
  status: "needs_passphrase" | "encrypting" | "uploading" | "complete" | "error";
  includeInEmergency: boolean;
  key?: string;
  error?: string;
};

type PresignUploadResponse = {
  ok: boolean;
  method?: "POST";
  url?: string;
  key?: string;
  fields?: Record<string, string>;
  error?: string;
};

function emitPaywall(title?: string, description?: string) {
  const returnTo = window.location.pathname + window.location.search;
  window.dispatchEvent(
    new CustomEvent("uac:paywall", {
      detail: {
        title: title || "Paid feature",
        description:
          description ||
          "This feature is part of a paid plan. Build a plan starting at $4.99/month to unlock it.",
        returnTo,
      },
    })
  );
}

function xhrPostWithProgress(url: string, body: Blob, fields: Record<string, string>, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const pct = Math.min(99, Math.round((e.loaded / e.total) * 100));
      onProgress(pct);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      reject(new Error(`upload_failed_http_${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("upload_failed_network"));
    const form = new FormData();
    Object.entries(fields || {}).forEach(([key, value]) => form.append(key, value));
    form.append("file", body);
    xhr.send(form);
  });
}

export function UploadPage() {
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [passphrase, setPassphrase] = useState("");
  const [pin, setPin] = useState("");
  const [passphraseOpen, setPassphraseOpen] = useState(false);
  const passphraseOk = useMemo(() => passphrase.trim().length >= 8, [passphrase]);
  const pinOk = useMemo(() => /^\d{4,6}$/.test(pin), [pin]);

  const [isPaidCache, setIsPaidCache] = useState<boolean | null>(null);

  const updateFile = useCallback((id: string, patch: Partial<UploadingFile>) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  const checkPaid = useCallback(async () => {
    if (isPaidCache === true) return true;
    if (isPaidCache === false) return false;

    try {
      const r = await fetch("/files/list", { credentials: "include" });
      if (r.status === 402) {
        setIsPaidCache(false);
        return false;
      }
      if (r.ok) {
        setIsPaidCache(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [isPaidCache]);

  const startUpload = useCallback(
    async (uf: UploadingFile) => {
      try {
        const paid = await checkPaid();
        if (!paid) {
          emitPaywall(
            "Vault uploads are a paid feature",
            "Build a plan to start storing encrypted files in your vault."
          );
          updateFile(uf.id, { status: "error", progress: 0, error: "payment_required" });
          return;
        }

        if (!passphraseOk || !pinOk) {
          updateFile(uf.id, { status: "needs_passphrase", progress: 0, error: undefined });
          setPassphraseOpen(true);
          return;
        }

        const unlockResp = await fetch("/auth/unlock-vault", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ pin }),
        });
        const unlock = await unlockResp.json().catch(() => ({}));
        if (!unlockResp.ok || !unlock?.ok) {
          updateFile(uf.id, { status: "needs_passphrase", progress: 0, error: unlock?.error || "vault_locked" });
          setPassphraseOpen(true);
          toast({
            title: "Vault unlock failed",
            description: unlock?.error === "invalid_pin" ? "Incorrect safety PIN." : String(unlock?.error || "Could not unlock vault."),
            variant: "destructive",
          });
          return;
        }

        updateFile(uf.id, { status: "encrypting", progress: 5, error: undefined });

        let pubKey: CryptoKey;
        let pubSpkiB64: string;

        try {
          const kp = await ensureUserKeypair(passphrase.trim());
          pubKey = kp.pubKey;
          pubSpkiB64 = kp.pubSpkiB64;
        } catch (e: any) {
          const msg = String(e?.message || "");
          if (msg === "bad_passphrase") {
            updateFile(uf.id, { status: "needs_passphrase", progress: 0, error: "bad_passphrase" });
            setPassphraseOpen(true);
            toast({
              title: "Wrong passphrase",
              description: "That passphrase can’t unlock your vault key. Enter the passphrase used when uploading.",
              variant: "destructive",
            });
            return;
          }
          throw e;
        }

        const enc = await encryptFileToAesGcm(uf.file);
        const ciphertextBlob = enc.blob as Blob;
        const rawAes = enc.rawAes as Uint8Array;
        const chunkMeta = (enc as any).meta || null;

        updateFile(uf.id, { progress: 15 });

        const presignResp = await fetch("/files/presign-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            filename: uf.file.name,
            contentType: uf.file.type || "application/octet-stream",
            sizeBytes: ciphertextBlob.size,
          }),
        });

        if (presignResp.status === 402) {
          setIsPaidCache(false);
          emitPaywall(
            "Vault uploads are a paid feature",
            "Build a plan to start storing encrypted files in your vault."
          );
          updateFile(uf.id, { status: "error", progress: 0, error: "payment_required" });
          return;
        }

        const presign: PresignUploadResponse = await presignResp.json().catch(() => ({ ok: false, error: "bad_json" }));

        if (!presignResp.ok || !presign.ok || !presign.url || !presign.key) {
          const msg = presign?.error || `presign_failed_http_${presignResp.status}`;
          updateFile(uf.id, { status: "error", progress: 0, error: msg });
          toast({
            title: "Upload failed",
            description: `Could not start upload (${msg}).`,
            variant: "destructive",
          });
          return;
        }

        updateFile(uf.id, { status: "uploading", progress: 20, key: presign.key });

        await xhrPostWithProgress(
          presign.url,
          ciphertextBlob,
          presign.fields || {},
          (pct) => updateFile(uf.id, { progress: Math.max(20, pct) })
        );

        updateFile(uf.id, { progress: 99 });

        const confirmResp = await fetch("/files/confirm-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            key: presign.key,
            size_bytes: ciphertextBlob.size,
          }),
        });

        const confirm = await confirmResp.json().catch(() => ({}));
        if (!confirmResp.ok || !confirm?.ok) {
          const msg = confirm?.error || "confirm_failed";
          updateFile(uf.id, { status: "error", progress: 0, error: msg });
          toast({
            title: "Upload failed",
            description: `Confirm step failed (${msg}).`,
            variant: "destructive",
          });
          return;
        }
	await saveEscrowForFile(presign.key, rawAes);

        const wrappedAesB64 = await wrapAesKeyForUser(pubKey, rawAes);

        const envResp = await fetch("/files/save-user-envelope", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            file_id: presign.key,
            alg: "RSA-OAEP+AES-256-GCM",
            enc_key_b64: wrappedAesB64,
            meta_json: {
              original_name: uf.file.name,
              original_content_type: uf.file.type || "application/octet-stream",
              original_size_bytes: uf.file.size,
              ciphertext_size_bytes: ciphertextBlob.size,
              chunked: true,
              chunk_meta: chunkMeta,
            },
          }),
        });

        const env = await envResp.json().catch(() => ({}));
        if (!envResp.ok || !env?.ok) {
          const msg = env?.error || "envelope_save_failed";
          updateFile(uf.id, { status: "error", progress: 0, error: msg });
          toast({
            title: "Upload failed",
            description: `Could not save encryption envelope (${msg}).`,
            variant: "destructive",
          });
          return;
        }

        updateFile(uf.id, { status: "complete", progress: 100 });
        toast({
          title: "File uploaded (encrypted)",
          description: `${uf.file.name} was encrypted locally and uploaded.`,
        });
      } catch (e: any) {
        const msg = String(e?.message || "upload_failed");
        updateFile(uf.id, { status: "error", progress: 0, error: msg });
        toast({ title: "Upload failed", description: msg, variant: "destructive" });
      }
    },
    [checkPaid, passphraseOk, pinOk, passphrase, pin, toast, updateFile]
  );

  const resumePassphraseQueue = useCallback(() => {
    setFiles((prev) => {
      const pending = prev.filter((f) => f.status === "needs_passphrase");
      if (pending.length) {
        setTimeout(() => pending.forEach((f) => startUpload(f)), 0);
      }
      return prev;
    });
  }, [startUpload]);

  const handleFiles = useCallback(
    (newFiles: FileList | null) => {
      if (!newFiles) return;

      const now = Date.now();
      const uploadFiles: UploadingFile[] = Array.from(newFiles).map((file) => ({
        id: `${now}-${Math.random().toString(16).slice(2)}-${file.name}`,
        file,
        progress: 0,
        status: "encrypting",
        includeInEmergency: true,
      }));

      setFiles((prev) => [...prev, ...uploadFiles]);
      uploadFiles.forEach((uf) => startUpload(uf));
    },
    [startUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <Dialog open={passphraseOpen} onOpenChange={setPassphraseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" /> Vault passphrase
            </DialogTitle>
            <DialogDescription>
              Your passphrase unlocks your encrypted vault key on any device. The encrypted key is backed up to your account.
            </DialogDescription>
          </DialogHeader>

          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="Safety PIN"
            autoComplete="off"
          />

          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="Vault passphrase, at least 8 characters"
            autoComplete="off"
          />

          <div className="rounded-lg border border-border p-3 text-sm text-muted-foreground flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <div>
              Keep your vault passphrase in a password manager. For files uploaded before key syncing, unlock
              the vault on the original device once to back up its key before clearing site data.
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              onClick={() => {
                setPassphraseOpen(false);
                resumePassphraseQueue();
              }}
              disabled={!passphraseOk || !pinOk}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Upload Files</h1>
        <p className="text-muted-foreground">Files are encrypted on your device before upload. Only ciphertext is stored.</p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-2xl p-12 text-center transition-all",
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        )}
      >
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Upload className="h-8 w-8 text-primary" />
        </div>
        <h3 className="font-semibold text-foreground mb-2">Drop files here</h3>
        <p className="text-sm text-muted-foreground mb-4">or click to browse</p>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={(e) => {
            handleFiles(e.target.files);
            e.currentTarget.value = "";
          }}
          className="hidden"
          id="file-input"
        />

        <Button variant="outline" asChild>
          <label htmlFor="file-input">Choose files</label>
        </Button>
      </div>

      {files.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-foreground">Upload Queue</h3>
          {files.map((uf) => (
            <Card key={uf.id}>
              <CardContent className="flex items-center gap-4 py-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  {uf.status === "complete" ? (
                    <Check className="h-5 w-5 text-success" />
                  ) : (
                    <FileText className="h-5 w-5 text-primary" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{uf.file.name}</p>

                  <div className="flex items-center gap-2 mt-1">
                    {uf.status === "needs_passphrase" && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Lock className="h-3 w-3" /> Waiting for passphrase...
                      </span>
                    )}

                    {uf.status === "encrypting" && (
                      <span className="text-xs text-warning flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Encrypting...
                      </span>
                    )}

                    {uf.status === "uploading" && (
                      <span className="text-xs text-primary flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Uploading...
                      </span>
                    )}

                    {uf.status === "complete" && <span className="text-xs text-success">Complete</span>}

                    {uf.status === "error" && (
                      <span className="text-xs text-destructive">Error{uf.error ? `: ${uf.error}` : ""}</span>
                    )}

                    <Progress value={uf.progress} className="h-1 flex-1 max-w-32" />
                  </div>

                  {uf.key && <p className="text-[10px] text-muted-foreground mt-1 truncate">{uf.key}</p>}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Shield className={cn("h-4 w-4", uf.includeInEmergency ? "text-primary" : "text-muted-foreground")} />
                    <Switch
                      checked={uf.includeInEmergency}
                      onCheckedChange={(checked) => {
                        setFiles((prev) => prev.map((f) => (f.id === uf.id ? { ...f, includeInEmergency: checked } : f)));
                      }}
                    />
                  </div>

                  <Button variant="ghost" size="icon" onClick={() => removeFile(uf.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
