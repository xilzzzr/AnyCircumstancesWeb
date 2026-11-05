import { privateInputProps } from "@/lib/privateInputProps";
import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { VaultDocumentEditor, RecipientNoteField } from "@/components/app/VaultDocumentEditor";
import { documentFile, sealRecipientNote, type VaultDocument } from "@/lib/vaultDocuments";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, X, FileText, Check, Loader2, Lock, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { encryptFileToAesGcm, ensureUserKeypair, wrapAesKeyForUser } from "@/lib/vaultCrypto";
import { useAuth } from "@/contexts/AuthContext";

async function saveEscrowForFile(fileId: string, rawAesKey: Uint8Array) {
  const pubRes = await fetch("/files/escrow-public-key", { credentials: "include" });
  const pubJson = await pubRes.json();
  if (!pubRes.ok || !pubJson?.ok || !pubJson?.public_key_pem) {
    throw new Error("escrow_public_key_unavailable");
  }

  const pem: string = String(pubJson.public_key_pem);
  const keyRef: string = String(pubJson.key_ref || "");
  if (!keyRef) throw new Error("escrow_key_ref_missing");
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
    credentials: "include", cache: "no-store",
    body: JSON.stringify({
      file_id: fileId,
      alg: "rsa-oaep-sha256",
      enc_key_b64: wrappedB64,
      key_ref: keyRef,
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
  savedSizeBytes?: number;
  note: string;
  documentTemplate?: VaultDocument["template"];
  status: "ready" | "needs_pin" | "needs_passphrase" | "encrypting" | "uploading" | "complete" | "error";
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
  useEffect(() => {
    const pending = files.some(file => file.status !== "complete");
    const guard = (event: BeforeUnloadEvent) => { if (pending) { event.preventDefault(); event.returnValue = ""; } };
    const navigation = (event: MouseEvent) => {
      if (pending && event.target instanceof Element && event.target.closest("a[href]") && !window.confirm("Some files have not been saved. Leave this page?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", guard);
    document.addEventListener("click", navigation, true);
    return () => { window.removeEventListener("beforeunload", guard); document.removeEventListener("click", navigation, true); };
  }, [files]);
  const [dragOver, setDragOver] = useState(false);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();
  const { unlockVault, vaultLocked } = useAuth();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const runningUploads = useRef(new Set<string>());
  const [pin, setPin] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  const [passphrase, setPassphrase] = useState("");
  const [passphraseOpen, setPassphraseOpen] = useState(false);
  useEffect(() => {
    if (files.length && files.every(file => file.status === "complete")) setPassphrase("");
  }, [files]);
  const passphraseOk = useMemo(() => passphrase.trim().length >= 8, [passphrase]);

  const previouslyUnlocked = useRef(false);
  useEffect(() => {
    if (!vaultLocked) { previouslyUnlocked.current = true; return; }
    if (previouslyUnlocked.current) {
      setFiles([]);
      setPassphrase("");
      setPin("");
      setCreating(false);
      setPassphraseOpen(false);
      setPinOpen(false);
      previouslyUnlocked.current = false;
    }
  }, [vaultLocked]);

  const [isPaidCache, setIsPaidCache] = useState<boolean | null>(null);

  const updateFile = useCallback((id: string, patch: Partial<UploadingFile>) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  const checkPaid = useCallback(async () => {
    if (isPaidCache === true) return true;
    if (isPaidCache === false) return false;

    try {
      const r = await fetch("/auth/billing/status", { credentials: "include" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return false;
      const paid = data?.status === "active";
      setIsPaidCache(paid);
      return paid;
    } catch {
      return false;
    }
  }, [isPaidCache]);

  const startUpload = useCallback(
    async (uf: UploadingFile) => {
      if (runningUploads.current.has(uf.id)) return;
      runningUploads.current.add(uf.id);
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

        if (!passphraseOk) {
          updateFile(uf.id, { status: "needs_passphrase", progress: 0, error: undefined });
          setPassphraseOpen(true);
          return;
        }

        updateFile(uf.id, { status: "encrypting", progress: 5, error: undefined });

        let pubKey: CryptoKey;

        try {
          const kp = await ensureUserKeypair(passphrase.trim());
          pubKey = kp.pubKey;
        } catch (e: unknown) {
          const msg = String(e instanceof Error ? e.message : "");
          if (msg === "vault_locked") {
            updateFile(uf.id, { status: "needs_pin", progress: 0, error: undefined });
            setPinOpen(true);
            return;
          }
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

        if (uf.key) {
          const cleanup = await fetch("/files/delete", { method: "POST", credentials: "include", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: uf.key }) });
          if (!cleanup.ok && cleanup.status !== 404) throw new Error("Could not clear the incomplete upload. Please retry.");
          updateFile(uf.id, { key: undefined });
        }

        const enc = await encryptFileToAesGcm(uf.file);
        const ciphertextBlob = enc.blob as Blob;
        const rawAes = enc.rawAes as Uint8Array;
        const chunkMeta = enc.meta || null;

        updateFile(uf.id, { progress: 15 });

        const presignResp = await fetch("/files/presign-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include", cache: "no-store",
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
          credentials: "include", cache: "no-store",
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
          credentials: "include", cache: "no-store",
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
              recipient_note: await sealRecipientNote(uf.note, rawAes),
              document_template: uf.documentTemplate,
              content_revision: crypto.randomUUID(),
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

        updateFile(uf.id, { status: "complete", progress: 100, note: "", savedSizeBytes: uf.file.size, file: new File([], uf.file.name, { type: uf.file.type }) });
        toast({
          title: "Saved to your vault",
          description: `${uf.file.name} is saved. Assign it to recipients in Emergency contacts.`,
        });
      } catch (e: unknown) {
        const msg = String(e instanceof Error ? e.message : "upload_failed");
        updateFile(uf.id, { status: "error", progress: 0, error: msg });
        toast({ title: "Upload failed", description: msg, variant: "destructive" });
      } finally {
        runningUploads.current.delete(uf.id);
      }
    },
    [checkPaid, passphraseOk, passphrase, toast, updateFile]
  );

  const handlePinUnlock = useCallback(async () => {
    if (!/^\d{4,6}$/.test(pin) || unlocking) return;
    setUnlocking(true);
    try {
      const ok = await unlockVault(pin);
      if (!ok) {
        toast({ title: "Incorrect PIN", description: "Enter your safety PIN to unlock the vault.", variant: "destructive" });
        return;
      }
      setPinOpen(false);
      setPin("");
      const pending = files.filter((file) => file.status === "needs_pin");
      setTimeout(() => pending.forEach((file) => startUpload(file)), 0);
    } finally {
      setUnlocking(false);
    }
  }, [files, pin, startUpload, toast, unlockVault, unlocking]);

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
        status: "ready",
        note: "",
      }));

      setFiles((prev) => [...prev, ...uploadFiles]);

    },
    []
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
      <Dialog open={pinOpen} onOpenChange={(open) => !unlocking && setPinOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" /> Unlock vault
            </DialogTitle>
            <DialogDescription>
              Enter your safety PIN before the app can retrieve your encrypted vault-key backup.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="Safety PIN"
            autoComplete="off"
            onKeyDown={(event) => { if (event.key === "Enter") handlePinUnlock(); }}
          />
          <DialogFooter>
            <Button onClick={handlePinUnlock} disabled={unlocking || !/^\d{4,6}$/.test(pin)}>
              {unlocking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            {...privateInputProps}
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="At least 8 characters"
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
              disabled={!passphraseOk}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Upload Files</h1>
        <p className="text-muted-foreground">Upload a file or write down passwords, instructions, and messages. Contents and recipient notes are encrypted on your device before saving.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Button variant={creating ? "outline" : "default"} onClick={() => { if (!creating || window.confirm("Leave the document editor? Unsaved changes will be lost.")) setCreating(false); }}>Upload a file</Button>
        <Button variant={creating ? "default" : "outline"} onClick={() => setCreating(true)}>Create a file</Button>
      </div>
      {creating && <VaultDocumentEditor onCancel={() => setCreating(false)} onSave={async (document, note) => {
        const uf: UploadingFile = { id: crypto.randomUUID(), file: documentFile(document), note, documentTemplate: document.template, progress: 0, status: "ready" };
        setFiles(prev => [...prev, uf]);
        setCreating(false);
        void startUpload(uf);
      }} />}
      <p className="text-sm text-muted-foreground">Saving does not send your files. <Link className="underline" to="/app/emergency-contacts">Choose recipients and assign files</Link> after saving.</p>
      {!creating && <div
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
      </div>}

      {files.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-foreground">Files to save</h3>
          {files.map((uf) => (
            <Card key={uf.id}>
              <CardContent className="flex flex-wrap items-center gap-4 py-3">
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
                    {uf.status === "ready" && <span className="text-xs text-muted-foreground">Ready to save</span>}
                    {uf.status === "needs_pin" && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Lock className="h-3 w-3" /> Waiting for safety PIN...
                      </span>
                    )}

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
                  {uf.status === "ready" && <Button onClick={() => startUpload(uf)}>Save to vault</Button>}
                  {uf.status === "error" && <Button onClick={() => startUpload(uf)}>Retry save</Button>}
                  {uf.status === "needs_pin" && <Button onClick={() => setPinOpen(true)}>Unlock vault</Button>}
                  {uf.status === "needs_passphrase" && <Button onClick={() => setPassphraseOpen(true)}>Enter passphrase</Button>}
                  {uf.status === "complete" && <Link className="text-sm underline" to="/app/emergency-contacts">Choose recipients</Link>}

                  <Button variant="ghost" size="icon" aria-label={`Remove ${uf.file.name} from this list`} disabled={["encrypting", "uploading"].includes(uf.status)} onClick={() => removeFile(uf.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {uf.status === "ready" && <div className="basis-full"><RecipientNoteField id={`note-${uf.id}`} value={uf.note} onChange={note => updateFile(uf.id, { note })} /></div>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

