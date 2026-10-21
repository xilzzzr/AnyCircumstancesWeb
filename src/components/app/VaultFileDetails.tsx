import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VaultDocumentEditor, RecipientNoteField } from "./VaultDocumentEditor";
import { decryptVaultFile, unlockFileEnvelope } from "@/lib/vaultDownload";
import {
  documentFile,
  openRecipientNote,
  parseDocument,
  sealRecipientNote,
  type VaultDocument,
} from "@/lib/vaultDocuments";
import { b64FromBytes, encryptFileToAesGcm } from "@/lib/vaultCrypto";
import type { VaultFile } from "@/lib/uacFilesApi";

export function VaultFileDetails({
  file,
  onClose,
  onSaved,
}: {
  file: VaultFile;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [passphrase, setPassphrase] = useState("");
  const [opened, setOpened] = useState<Awaited<
    ReturnType<typeof unlockFileEnvelope>
  > | null>(null);
  const [doc, setDoc] = useState<VaultDocument | undefined>();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  const close = () => {
    if (!busy && (!dirty || window.confirm("Discard your unsaved changes?")))
      onClose();
  };
  async function open() {
    setBusy(true);
    setError("");
    try {
      const result = file.document_template
        ? await decryptVaultFile(file, passphrase)
        : await unlockFileEnvelope(file.key, passphrase);
      const recipientNote = await openRecipientNote(
        result.envelope.meta_json?.recipient_note,
        result.rawKey,
      );
      if ("bytes" in result && result.bytes instanceof Uint8Array)
        setDoc(parseDocument(new TextDecoder().decode(result.bytes)));
      setNote(recipientNote);
      setOpened(result);
      setPassphrase("");
    } catch (e) {
      setError(
        e instanceof Error && e.message === "bad_passphrase"
          ? "Incorrect vault passphrase. Try again."
          : "Could not open this file. Check your vault passphrase and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function save(
    document: VaultDocument | undefined,
    recipientNote: string,
  ) {
    if (!opened || busy) return;
    setBusy(true);
    setError("");
    try {
      const payload: Record<string, unknown> = {
        file_id: file.key,
        expected_revision: opened.envelope.revision,
        recipient_note:
          (await sealRecipientNote(recipientNote, opened.rawKey)) || null,
      };
      if (document) {
        const file = documentFile(document);
        const encrypted = await encryptFileToAesGcm(file, opened.rawKey);
        payload.ciphertext_b64 = b64FromBytes(
          new Uint8Array(await encrypted.blob.arrayBuffer()),
        );
        payload.original_name = file.name;
      }
      const response = await fetch("/files/update-content", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.ok)
        throw new Error(
          response.status === 409
            ? "This file changed in another window. Close and reopen it before saving."
            : "Could not save. Your changes are still here. Please try again.",
        );
      setDirty(false);
      onSaved();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not save.";
      setError(message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        className="max-w-2xl max-h-[90dvh] overflow-y-auto"
        onPointerDownOutside={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {file.document_template
              ? "View or edit document"
              : "File instructions"}
          </DialogTitle>
          <DialogDescription>
            {file.name}. Changes stay in your vault and do not send the file.
          </DialogDescription>
        </DialogHeader>
        {!opened ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void open();
            }}
          >
            <Label htmlFor="details-passphrase">Vault passphrase</Label>
            <Input
              id="details-passphrase"
              type="password"
              autoComplete="off"
              value={passphrase}
              disabled={busy}
              onChange={(e) => setPassphrase(e.target.value)}
            />
            <Button disabled={busy || !passphrase.trim()}>
              {busy ? "Opening…" : "Open securely"}
            </Button>
          </form>
        ) : doc ? (
          <div onChange={() => setDirty(true)}>
            <VaultDocumentEditor
              initial={doc}
              initialNote={note}
              busy={busy}
              onSave={save}
              onCancel={onClose}
            />
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save(undefined, note).catch(() => {});
            }}
          >
            <RecipientNoteField
              value={note}
              disabled={busy}
              onChange={(value) => {
                setNote(value);
                setDirty(true);
              }}
            />
            <Button disabled={busy}>{busy ? "Saving…" : "Save note"}</Button>
          </form>
        )}
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
