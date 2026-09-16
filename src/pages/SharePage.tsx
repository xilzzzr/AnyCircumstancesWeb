import { useEffect, useState } from "react";
import { decryptUacBytes } from "@/lib/uacChunk";
import { useParams } from "react-router-dom";

type ShareLookup = {
  ok: boolean;
  file?: { id: string; content_type: string };
  token?: { expires_at: string; used_at?: string | null };
  error?: string;
};

type EnvelopeRes = {
  ok: boolean;
  contact_id?: number;
  file_id?: string;
  alg?: string;
  enc_key_b64?: string;
  meta_json?: any;
  error?: string;
};

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

const shareErrorCodes = new Set([
  "invalid_token", "token_expired", "missing_file_escrow", "escrow_private_key_missing",
  "missing_envelope_meta", "invalid_envelope_meta", "missing_public_key", "public_key_too_large",
  "invalid_public_key", "unwrap_failed", "download_failed", "decrypt_failed",
  "envelope_create_failed", "presign_failed", "rate_limited", "server_error",
]);

function safeShareError(error: unknown) {
  const code = error instanceof Error ? error.message.split(":")[0] : "";
  return shareErrorCodes.has(code) ? code : "secure_access_failed: Please retry or reload the link.";
}

export default function SharePage() {
  const { token: pathToken = "" } = useParams();
  const [token] = useState(() => {
    const fragmentToken = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
    return fragmentToken || pathToken;
  });

  const [lookup, setLookup] = useState<ShareLookup | null>(null);
  const [status, setStatus] = useState<string>("Loading link…");
  const [busy, setBusy] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string>("");
  const [downloadFilename, setDownloadFilename] = useState("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const fileId = lookup?.file?.id || "";
  const contentType = lookup?.file?.content_type || "application/octet-stream";
  const filename = downloadFilename || deriveFilenameFromKey(fileId);

  useEffect(() => {
    return () => { if (downloadUrl) URL.revokeObjectURL(downloadUrl); };
  }, [downloadUrl]);

  useEffect(() => {
    (async () => {
      setBusy(false);
      setDownloadUrl("");
      setErrorMsg("");
      try {
        setStatus("Loading link…");
        const res: ShareLookup = await fetch("/files/share-lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        }).then((r) => r.json());

        setLookup(res);

        if (!res.ok) {
          setStatus(res.error || "Invalid link");
          return;
        }

        setStatus("Link loaded.");
      } catch {
        setStatus("Failed to load link.");
        setErrorMsg("Could not load the link. Please retry.");
      }
    })();
  }, [token]);

  async function downloadAndDecrypt() {
    setBusy(true);
    setDownloadUrl("");
    setErrorMsg("");
    try {
      setStatus("Creating secure session…");
      const keyPair = await crypto.subtle.generateKey(
        { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
        true,
        ["encrypt", "decrypt"]
      );
      const privKey = keyPair.privateKey;
      const publicSpki = new Uint8Array(await crypto.subtle.exportKey("spki", keyPair.publicKey));
      const publicKeyB64 = b64(publicSpki);

      setStatus("Fetching envelope…");
      const env: EnvelopeRes = await fetch("/files/share-get-contact-envelope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, public_key: publicKeyB64 })
      }).then((r) => r.json());

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
        typeof meta.original_name === "string" && meta.original_name ? meta.original_name : deriveFilenameFromKey(fileId)
      );

      setStatus("Unwrapping key…");
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

      setStatus("Requesting download URL…");
      const dl = await fetch("/files/share-presign-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      }).then((r) => r.json());

      if (!dl.ok) throw new Error(dl.error || "presign_failed");

      setStatus("Downloading encrypted bytes…");
      let ciphertext: Uint8Array;
      try {
        const encRes = await fetch(dl.url);
        if (!encRes.ok) throw new Error("download_failed");
        ciphertext = new Uint8Array(await encRes.arrayBuffer());
      } catch {
        throw new Error("download_failed: could not download encrypted bytes.");
      }

      setStatus("Decrypting…");
      let plaintext: Uint8Array;
      try {
        plaintext = await decryptUacBytes(aesKey, ciphertext, meta);
      } catch {
        throw new Error("decrypt_failed: could not decrypt the file.");
      }

      const blob = new Blob([plaintext], { type: contentType });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setStatus("Decrypted. Use the download button.");
    } catch (e: unknown) {
      setStatus(`Error: ${safeShareError(e)}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-bold">Emergency File Access</h1>
        <p className="mt-2 text-sm opacity-80">Use this page to securely retrieve the file assigned to you.</p>

        <div className="mt-6 rounded-xl border p-5">
          <div className="text-sm">
            <div>
              <span className="opacity-70">Status:</span> {status}
            </div>

            {lookup?.ok && (
              <>
                <div className="mt-3">
                  <span className="opacity-70">File:</span> {filename}
                </div>
                <div className="mt-1">
                  <span className="opacity-70">Type:</span> {contentType}
                </div>
              </>
            )}

            {!lookup?.ok && lookup?.error && <div className="mt-3 text-red-500">Error: {lookup.error}</div>}

            {errorMsg && (
              <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-red-200 break-words">
                {errorMsg}
              </div>
            )}
          </div>

          {lookup?.ok && (
            <div className="mt-5 flex flex-col gap-3">
              <button
                className="rounded-lg bg-black text-white px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
                disabled={busy}
                onClick={downloadAndDecrypt}
              >
                Download + decrypt
              </button>

              {downloadUrl && (
                <a className="rounded-lg border px-4 py-2 text-sm hover:opacity-90 text-center" href={downloadUrl} download={downloadFilename || filename}>
                  Download decrypted file
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
