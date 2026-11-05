import { useEffect, useRef, useState } from "react";
import { decryptUacBytes } from "@/lib/uacChunk";
import { useParams } from "react-router-dom";

type ShareFile = { id: string; content_type: string };

type ShareLookup = {
  ok: boolean;
  file?: ShareFile;
  token?: { expires_at: string; used_at?: string | null; redeemed?: boolean };
  error?: string;
};

type EnvelopeRes = {
  ok: boolean;
  contact_id?: number;
  file_id?: string;
  alg?: string;
  enc_key_b64?: string;
  meta_json?: unknown;
  error?: string;
};

// checking: no token in the address, looking for an already-open session in this browser.
// landing: token held in memory, nothing redeemed yet.
// working: redeeming and/or downloading + decrypting.
// opened: a share session is active in this browser but the file isn't decrypted yet.
// ready: decrypted file available to save.
type Phase = "checking" | "landing" | "working" | "opened" | "ready" | "error";
type ErrorStage = "open" | "download";
type ShareErrorKind =
  | "already_redeemed"
  | "expired"
  | "invalid"
  | "session_expired"
  | "rate_limited"
  | "network"
  | "download"
  | "processing";

const SUPPORT_EMAIL = "contact@anycircumstances.com";
const TRUSTED_CHANNEL = "contact the person who set this up or their family through a trusted channel.";

const shareErrorCopy: Record<ShareErrorKind, { title: string; body: string; retry: boolean }> = {
  already_redeemed: {
    title: "This link has already been opened",
    body: `For security each link works once. If you didn't open it, ${TRUSTED_CHANNEL}`,
    retry: false,
  },
  expired: {
    title: "This link has expired",
    body: `Emergency links stop working after a set time, so this one can no longer be opened. If you still need the file, ${TRUSTED_CHANNEL}`,
    retry: false,
  },
  invalid: {
    title: "This link isn't valid",
    body: `The link may be incomplete or no longer active. Open it again directly from the email and make sure the whole link is used. If it still doesn't work, ${TRUSTED_CHANNEL}`,
    retry: false,
  },
  session_expired: {
    title: "Your access time has ended",
    body: `After a link is opened, the file can be downloaded for 20 minutes, and only in the browser where it was opened. For security the link can't be opened again. If you still need the file, ${TRUSTED_CHANNEL}`,
    retry: false,
  },
  rate_limited: {
    title: "Too many requests right now",
    body: "Please wait a minute, then try again.",
    retry: true,
  },
  network: {
    title: "We couldn't connect",
    body: "Check your internet connection, then try again.",
    retry: true,
  },
  download: {
    title: "The download didn't finish",
    body: "Check your internet connection, then try again.",
    retry: true,
  },
  processing: {
    title: "The file couldn't be prepared",
    body: "Please try again in a moment. If it keeps happening, email",
    retry: true,
  },
};

function classifyShareError(code: string): ShareErrorKind {
  switch (code) {
    case "token_already_redeemed":
      return "already_redeemed";
    case "token_expired":
      return "expired";
    case "invalid_token":
    case "missing_token":
      return "invalid";
    case "share_session_required":
    case "invalid_share_session":
      return "session_expired";
    case "rate_limited":
      return "rate_limited";
    case "network_error":
      return "network";
    case "download_failed":
      return "download";
    default:
      return "processing";
  }
}

function errorCode(error: unknown) {
  return error instanceof Error ? error.message.split(":")[0].trim() : "";
}

async function postJson(url: string, body: unknown) {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("network_error");
  }
  const data = await res.json().catch(() => null);
  if (!data || typeof data !== "object") throw new Error(res.status === 429 ? "rate_limited" : "server_error");
  return data;
}

function unb64(s: string) {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

function b64(u8: Uint8Array) {
  let out = "";
  for (let i = 0; i < u8.length; i++) out += String.fromCharCode(u8[i]);
  return btoa(out);
}

function deriveFilenameFromKey(key: string) {
  const base = key.split("/").pop() || "file.bin";
  if (base.length > 38 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i.test(base)) {
    return base.slice(37);
  }
  return base;
}

const primaryButton =
  "inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 sm:w-auto";
const headingClass = "text-2xl font-semibold leading-tight tracking-tight focus:outline-none";

export default function SharePage() {
  const { token: pathToken = "" } = useParams();
  const [token] = useState(() => {
    const fragmentToken = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
    return fragmentToken || pathToken;
  });

  const [phase, setPhase] = useState<Phase>(() => (token ? "landing" : "checking"));
  const [fileInfo, setFileInfo] = useState<ShareFile | null>(null);
  const [status, setStatus] = useState("");
  const [errorKind, setErrorKind] = useState<ShareErrorKind | null>(null);
  const [errorStage, setErrorStage] = useState<ErrorStage>("open");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [downloadFilename, setDownloadFilename] = useState("");

  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const focusPending = useRef(false);

  const contentType = fileInfo?.content_type || "application/octet-stream";
  const filename = downloadFilename || deriveFilenameFromKey(fileInfo?.id || "");

  useEffect(() => {
    return () => { if (downloadUrl) URL.revokeObjectURL(downloadUrl); };
  }, [downloadUrl]);

  // Move focus to the new heading after a state change the user started, so keyboard
  // and screen-reader users land on the new content instead of a removed button.
  useEffect(() => {
    if (!focusPending.current) return;
    focusPending.current = false;
    headingRef.current?.focus();
  }, [phase, errorKind]);

  // Without a token nothing can be redeemed. Only check whether this browser already has
  // an open share session (for example after a reload once the token was removed).
  useEffect(() => {
    if (token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = (await postJson("/files/share-lookup", { token: "" })) as ShareLookup;
        if (cancelled) return;
        if (res.ok && res.file) {
          setFileInfo(res.file);
          setPhase("opened");
        } else {
          setErrorKind(classifyShareError(res.error || "missing_token"));
          setErrorStage("open");
          setPhase("error");
        }
      } catch (e: unknown) {
        if (cancelled) return;
        setErrorKind(classifyShareError(errorCode(e)));
        setErrorStage("open");
        setPhase("error");
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  function fail(code: string, stage: ErrorStage) {
    focusPending.current = true;
    setStatus("");
    setErrorKind(classifyShareError(code));
    setErrorStage(stage);
    setPhase("error");
  }

  function removeTokenFromAddress() {
    if (window.location.hash || pathToken) {
      const path = pathToken ? "/share" : window.location.pathname;
      window.history.replaceState(null, "", path + window.location.search);
    }
  }

  async function openSharedFile() {
    focusPending.current = true;
    setErrorKind(null);
    setDownloadUrl("");
    setPhase("working");
    setStatus("Opening the secure link…");

    let res: ShareLookup;
    try {
      res = (await postJson("/files/share-lookup", { token })) as ShareLookup;
    } catch (e: unknown) {
      fail(errorCode(e), "open");
      return;
    }

    if (!res.ok || !res.file) {
      fail(res.error || "invalid_token", "open");
      return;
    }

    // The link is single-use and now redeemed; keep it out of the address bar and history.
    removeTokenFromAddress();
    setFileInfo(res.file);
    await downloadAndDecrypt(res.file);
  }

  async function downloadAndDecrypt(target: ShareFile) {
    focusPending.current = true;
    setErrorKind(null);
    setDownloadUrl("");
    setPhase("working");
    try {
      setStatus("Preparing a temporary key…");
      const keyPair = await crypto.subtle.generateKey(
        { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
        true,
        ["encrypt", "decrypt"]
      );
      const privKey = keyPair.privateKey;
      const publicSpki = new Uint8Array(await crypto.subtle.exportKey("spki", keyPair.publicKey));
      const publicKeyB64 = b64(publicSpki);

      setStatus("Requesting the file key…");
      const env = (await postJson("/files/share-get-contact-envelope", { public_key: publicKeyB64 })) as EnvelopeRes;

      if (!env.ok) throw new Error(env.error || "envelope_create_failed");

      let meta;
      try {
        meta = typeof env.meta_json === "string" ? JSON.parse(env.meta_json) : env.meta_json;
      } catch {
        throw new Error("invalid_envelope_meta");
      }
      if (!meta) throw new Error("missing_envelope_meta");
      if (typeof meta !== "object" || Array.isArray(meta)) throw new Error("invalid_envelope_meta");
      setDownloadFilename(
        typeof meta.original_name === "string" && meta.original_name ? meta.original_name : deriveFilenameFromKey(target.id)
      );

      const wrappedB64Raw = String(env.enc_key_b64 || "");
      const wrappedB64 = wrappedB64Raw.replace(/\s+/g,"").replace(/-/g,"+").replace(/_/g,"/");
      const wrappedB64Padded = wrappedB64 + "===".slice((wrappedB64.length + 3) % 4);
      let rawAes: Uint8Array;
      try {
        const wrappedAes = unb64(wrappedB64Padded);
        rawAes = new Uint8Array(await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privKey, wrappedAes));
      } catch {
        throw new Error("unwrap_failed: RSA unwrap failed for the temporary emergency-access key.");
      }

      const aesKey = await crypto.subtle.importKey("raw", rawAes, { name: "AES-GCM" }, false, ["decrypt"]);

      setStatus("Requesting the download…");
      const dl = await postJson("/files/share-presign-download", {});

      if (!dl.ok || typeof dl.url !== "string") throw new Error(dl.error || "presign_failed");

      setStatus("Downloading the encrypted file…");
      let ciphertext: Uint8Array;
      try {
        const encRes = await fetch(dl.url);
        if (!encRes.ok) throw new Error("download_failed");
        ciphertext = new Uint8Array(await encRes.arrayBuffer());
      } catch {
        throw new Error("download_failed: could not download encrypted bytes.");
      }

      setStatus("Decrypting in your browser…");
      let plaintext: Uint8Array;
      try {
        plaintext = await decryptUacBytes(aesKey, ciphertext, meta);
      } catch {
        throw new Error("decrypt_failed: could not decrypt the file.");
      }

      const blob = new Blob([plaintext], { type: target.content_type || "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setStatus("");
      focusPending.current = true;
      setPhase("ready");
    } catch (e: unknown) {
      fail(errorCode(e), "download");
    }
  }

  function retry() {
    // After redemption, retrying reuses this browser's share session instead of the spent link.
    return errorStage === "download" && fileInfo ? downloadAndDecrypt(fileInfo) : openSharedFile();
  }

  const errorCopy = errorKind ? shareErrorCopy[errorKind] : null;
  const fileDetails = fileInfo && (
    <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      <dt className="text-muted-foreground">File</dt>
      <dd className="break-words">{filename}</dd>
      <dt className="text-muted-foreground">Type</dt>
      <dd className="break-words">{contentType}</dd>
    </dl>
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <p className="micro-label">
          <span className="status-dot" aria-hidden="true" /> ANYCIRCUMSTANCES
        </p>

        <div className="editorial-card mt-6 p-6 sm:p-8">
          {phase === "landing" && (
            <>
              <h1 ref={headingRef} tabIndex={-1} className={headingClass}>
                Someone shared important information with you
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                It was sent through AnyCircumstances on behalf of the account owner.
              </p>
              <ul className="mt-5 list-disc space-y-2 pl-5 text-sm leading-relaxed">
                <li>Open it on the device where you want to save the file.</li>
                <li>
                  The link works once. After you open it, you have 20 minutes in this browser to download and
                  decrypt the file.
                </li>
                <li>Links also expire, by default 30 days after they are sent.</li>
              </ul>
              <button type="button" className={`${primaryButton} mt-6`} onClick={openSharedFile}>
                Open shared file
              </button>
              <p className="mt-3 text-xs text-muted-foreground">The link isn&apos;t used until you press this button.</p>
            </>
          )}

          {phase === "checking" && (
            <>
              <h1 ref={headingRef} tabIndex={-1} className={headingClass}>Emergency file access</h1>
              <p role="status" aria-live="polite" className="mt-3 text-sm text-muted-foreground">
                Checking this browser for an open link…
              </p>
            </>
          )}

          {phase === "working" && (
            <>
              <h1 ref={headingRef} tabIndex={-1} className={headingClass}>Preparing your file</h1>
              <p className="mt-3 text-sm text-muted-foreground">Keep this page open. This can take a moment for large files.</p>
              <p role="status" aria-live="polite" className="mt-4 text-sm">{status}</p>
              {fileDetails}
            </>
          )}

          {phase === "opened" && (
            <>
              <h1 ref={headingRef} tabIndex={-1} className={headingClass}>Your shared file</h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                This link was already opened in this browser. Download and decrypt the file before your 20 minutes of
                access end.
              </p>
              {fileDetails}
              <button
                type="button"
                className={`${primaryButton} mt-6`}
                onClick={() => (fileInfo ? downloadAndDecrypt(fileInfo) : undefined)}
              >
                Download + decrypt
              </button>
            </>
          )}

          {phase === "ready" && (
            <>
              <h1 ref={headingRef} tabIndex={-1} className={headingClass}>Your file is ready</h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                It was decrypted in this browser. Save it now: access through this link ends 20 minutes after it was
                opened, and the link can&apos;t be opened again.
              </p>
              {fileDetails}
              {downloadUrl && (
                <a className={`${primaryButton} mt-6`} href={downloadUrl} download={downloadFilename || filename}>
                  Download decrypted file
                </a>
              )}
            </>
          )}

          {phase === "error" && errorCopy && (
            <div role="alert">
              <h1 ref={headingRef} tabIndex={-1} className={headingClass}>{errorCopy.title}</h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {errorCopy.body}
                {errorKind === "processing" && (
                  <>
                    {" "}
                    <a className="underline underline-offset-4" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
                  </>
                )}
              </p>
              {errorCopy.retry && errorStage === "download" && (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  You can retry until your 20 minutes of access in this browser end.
                </p>
              )}
              {errorCopy.retry && (
                <button type="button" className={`${primaryButton} mt-6`} onClick={retry}>
                  Try again
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
