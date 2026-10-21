import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { bytesFromB64, b64FromBytes } from "@/lib/vaultCrypto";
import { decryptUacBytes } from "@/lib/uacChunk";
import {
  DOCUMENT_TYPE,
  documentText,
  openRecipientNote,
  parseDocument,
  type FileMeta,
  type VaultDocument,
} from "@/lib/vaultDocuments";
import {
  documentPdf,
  downloadBlob,
  downloadPackage,
  textPdf,
  type PackageItem,
} from "@/lib/vaultExports";

type ReleasedFile = {
  id: string;
  name: string;
  content_type: string;
  size_bytes: number;
};
type OpenFile = ReleasedFile & {
  rawKey: Uint8Array;
  meta: FileMeta;
  note: string;
};
async function shareRequest(path: string, body: unknown = {}) {
  const response = await fetch(`/files/${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || !data.ok)
    throw new Error(data.error || "secure_access_failed");
  return data;
}
const friendlyError = (e: unknown) => {
  const code = e instanceof Error ? e.message : "";
  if (code === "token_expired") return "This access link has expired.";
  if (code === "token_already_redeemed")
    return "This link has already been opened. Use the browser where you first opened it.";
  if (code === "share_session_required" || code === "invalid_share_session")
    return "Your secure session has expired. Open another unused access link from your email.";
  if (code === "package_too_large")
    return "This package is too large to download together in this browser. Download the files individually.";
  return "Could not securely open the files. Please retry. If the problem continues, contact support.";
};
export default function SharePage() {
  const { token: pathToken = "" } = useParams();
  const [token] = useState(
    () =>
      new URLSearchParams(window.location.hash.slice(1)).get("token") ||
      pathToken,
  );
  const [files, setFiles] = useState<ReleasedFile[]>([]);
  const [opened, setOpened] = useState<OpenFile[]>([]);
  const [preview, setPreview] = useState<Record<string, VaultDocument>>({});
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Loading your secure link…");
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await shareRequest("share-lookup", { token });
        if (window.location.hash)
          window.history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search,
          );
        const data = await shareRequest("share-package");
        if (!cancelled) {
          setFiles(data.files);
          setStatus("Your files are ready to open.");
        }
      } catch (e) {
        if (!cancelled) {
          setStatus("Could not open the link.");
          setError(friendlyError(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);
  async function unlock() {
    setBusy(true);
    setError("");
    setStatus("Opening your files and instructions…");
    try {
      const pair = await crypto.subtle.generateKey(
        {
          name: "RSA-OAEP",
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"],
      );
      const publicKey = b64FromBytes(
        new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey)),
      );
      const results: OpenFile[] = [];
      const unavailable: string[] = [];
      for (const file of files) {
        try {
          const env = await shareRequest("share-get-contact-envelope", {
            file_id: file.id,
            public_key: publicKey,
          });
          const rawKey = new Uint8Array(
            await crypto.subtle.decrypt(
              { name: "RSA-OAEP" },
              pair.privateKey,
              bytesFromB64(env.enc_key_b64),
            ),
          );
          const meta =
            typeof env.meta_json === "string"
              ? JSON.parse(env.meta_json)
              : env.meta_json;
          if (!meta || typeof meta !== "object")
            throw new Error("invalid_envelope_meta");
          results.push({
            ...file,
            name: meta.original_name || file.name,
            rawKey,
            meta,
            note: await openRecipientNote(meta.recipient_note, rawKey),
          });
        } catch {
          unavailable.push(file.name);
        }
      }
      if (!results.length) throw new Error("secure_access_failed");
      const introductions: Record<string, VaultDocument> = {};
      for (const file of results.filter(
        (f) => f.meta.document_template === "introduction",
      )) {
        try {
          const item = await retrieve(file);
          if (item.document) introductions[file.id] = item.document;
        } catch {
          unavailable.push(file.name);
        }
      }
      setPreview(introductions);
      setOpened(results);
      setStatus("Files opened. Read the notes below before downloading.");
      if (unavailable.length)
        setError(
          `Some files or instructions could not be opened: ${unavailable.join(", ")}. You can download the available files individually and retry opening the package.`,
        );
    } catch (e) {
      setError(friendlyError(e));
      setStatus("Could not open all files. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  async function retrieve(file: OpenFile): Promise<PackageItem> {
    const data = await shareRequest("share-presign-download", {
      file_id: file.id,
    });
    const response = await fetch(data.url);
    if (!response.ok) throw new Error("download_failed");
    const key = await crypto.subtle.importKey(
      "raw",
      file.rawKey,
      "AES-GCM",
      false,
      ["decrypt"],
    );
    const plain = await decryptUacBytes(
      key,
      new Uint8Array(await response.arrayBuffer()),
      file.meta,
    );
    if (file.content_type === DOCUMENT_TYPE) {
      const document = parseDocument(new TextDecoder().decode(plain));
      return {
        name: file.name,
        note: file.note,
        document,
        blob: await documentPdf(document, file.note),
      };
    }
    return {
      name: file.name,
      note: file.note,
      blob: new Blob([plain], {
        type: file.meta.original_content_type || file.content_type,
      }),
    };
  }
  async function action(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  async function instructions() {
    const intro: string[] = [];
    for (const file of opened.filter(
      (f) => f.meta.document_template === "introduction",
    )) {
      const item = await retrieve(file);
      if (item.document) intro.push(documentText(item.document));
    }
    const missing = files.filter((f) => !opened.some((o) => o.id === f.id));
    if (missing.length)
      intro.push(
        "Files not available in this download: " +
          missing.map((f) => f.name).join(", "),
      );
    const text = [
      ...intro,
      ...opened.map(
        (f) => `${f.name}\n${f.note || "No additional instructions."}`,
      ),
    ].join("\n\n");
    downloadBlob(
      await textPdf("Your files and instructions", text),
      "Start here.pdf",
    );
  }
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-5 py-10 space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Your files and instructions</h1>
          <p className="mt-2 text-muted-foreground">
            Read the owner's notes, then open or download the files they left
            for you.
          </p>
        </header>
        <p role="status" aria-live="polite">
          {status}
        </p>
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-destructive p-4 text-destructive"
          >
            {error}
          </p>
        )}
        {!!files.length && !opened.length && (
          <>
            <ul className="list-disc pl-6">
              {files.map((f) => (
                <li key={f.id}>{f.name}</li>
              ))}
            </ul>
            <Button disabled={busy} onClick={unlock}>
              {busy ? "Opening…" : "Open files and instructions"}
            </Button>
          </>
        )}
        {!!opened.length && (
          <>
            {!!error && (
              <Button disabled={busy} variant="outline" onClick={unlock}>
                Retry opening files and instructions
              </Button>
            )}
            <div className="rounded-xl border p-4 space-y-3">
              <h2 className="font-semibold">Start here</h2>
              {opened
                .filter(
                  (file) =>
                    file.meta.document_template === "introduction" &&
                    preview[file.id],
                )
                .map((file) => (
                  <div key={file.id} className="rounded-lg bg-muted p-4">
                    <h3 className="font-medium">{preview[file.id].title}</h3>
                    <p className="whitespace-pre-wrap break-words mt-2">
                      {preview[file.id].body}
                    </p>
                  </div>
                ))}
              <p className="text-sm text-muted-foreground">
                The instructions download lists your files and the notes
                attached to each one. The package download includes the files
                and a copy of these instructions.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={busy}
                  variant="outline"
                  onClick={() => action(instructions)}
                >
                  Download instructions
                </Button>
                <Button
                  disabled={busy || opened.length !== files.length}
                  onClick={() =>
                    action(async () => {
                      if (
                        opened.reduce((sum, f) => sum + f.size_bytes, 0) >
                        256 * 1024 * 1024
                      )
                        throw new Error("package_too_large");
                      const items: PackageItem[] = [];
                      for (const file of opened)
                        items.push(await retrieve(file));
                      await downloadPackage(items);
                    })
                  }
                >
                  {busy ? "Working…" : "Download all files and notes"}
                </Button>
              </div>
            </div>
            {opened.map((file) => (
              <section
                key={file.id}
                className="rounded-xl border p-5 space-y-4"
              >
                <h2 className="text-lg font-semibold break-words">
                  {file.name}
                </h2>
                {file.note ? (
                  <div className="rounded-lg bg-muted p-4">
                    <h3 className="font-medium mb-2">Note from the owner</h3>
                    <p className="whitespace-pre-wrap break-words">
                      {file.note}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No additional instructions for this file.
                  </p>
                )}
                <div className="flex flex-wrap gap-3">
                  <Button
                    disabled={busy}
                    onClick={() =>
                      action(async () => {
                        const item = await retrieve(file);
                        downloadBlob(item.blob, item.name);
                      })
                    }
                  >
                    Download{" "}
                    {file.content_type === DOCUMENT_TYPE ? "PDF" : "file"}
                  </Button>
                  {file.content_type === DOCUMENT_TYPE && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        action(async () => {
                          if (preview[file.id]) {
                            setPreview((p) => {
                              const next = { ...p };
                              delete next[file.id];
                              return next;
                            });
                            return;
                          }
                          const item = await retrieve(file);
                          if (item.document)
                            setPreview((p) => ({
                              ...p,
                              [file.id]: item.document!,
                            }));
                        })
                      }
                    >
                      {preview[file.id] ? "Hide document" : "Read document"}
                    </Button>
                  )}
                  {file.note && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        action(async () => {
                          downloadBlob(
                            await textPdf(
                              `Instructions for ${file.name}`,
                              file.note,
                            ),
                            `${file.name}-instructions.pdf`,
                          );
                        })
                      }
                    >
                      Download this note
                    </Button>
                  )}
                </div>
                {preview[file.id] && (
                  <pre className="whitespace-pre-wrap break-words font-sans rounded-lg bg-muted p-4">
                    {documentText(preview[file.id])}
                  </pre>
                )}
              </section>
            ))}
            <p className="text-sm text-muted-foreground">
              Downloads may contain passwords or private information. Anyone
              with access to the downloaded files may be able to read them.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
