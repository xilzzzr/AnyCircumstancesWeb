import { useEffect, useMemo, useState } from "react";
import { decryptUacBytes } from "@/lib/uacChunk";
import { useParams } from "react-router-dom";

type ShareLookup = {
  ok: boolean;
  contact?: { id: number; email: string; verified_at?: string | null; has_public_key?: boolean };
  file?: { id: string; owner_user_id: number; content_type: string; created_at: string };
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

type PresignRes = {
  ok: boolean;
  url?: string;
  file_id?: string;
  contact_id?: number;
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

async function readTextSafely(res: Response, max = 8000) {
  try {
    const t = await res.text();
    return t.length > max ? t.slice(0, max) + "…" : t;
  } catch {
    return "";
  }
}

export default function SharePage() {
  const { token = "" } = useParams();

  const [lookup, setLookup] = useState<ShareLookup | null>(null);
  const [status, setStatus] = useState<string>("Loading link…");
  const [busy, setBusy] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string>("");
  const [encryptedUrl, setEncryptedUrl] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const fileId = lookup?.file?.id || "";
  const contentType = lookup?.file?.content_type || "application/octet-stream";
  const filename = useMemo(() => (fileId ? deriveFilenameFromKey(fileId) : "file.bin"), [fileId]);

  const hasLocalKeys = Boolean(
    localStorage.getItem("uac_contact_pub_spki_b64") && localStorage.getItem("uac_contact_priv_pkcs8_b64")
  );

  useEffect(() => {
    (async () => {
      setBusy(false);
      setDownloadUrl("");
      setEncryptedUrl("");
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
      } catch (e: any) {
        setStatus("Failed to load link.");
        setErrorMsg(String(e?.message || e));
      }
    })();
  }, [token]);

  async function ensureContactPublicKey() {
    const already = Boolean(lookup?.contact?.has_public_key);
    if (already) return true;

    const localPub = localStorage.getItem("uac_contact_pub_spki_b64") || "";
    if (!localPub) return false;

    const out = await fetch("/files/share-set-contact-public-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, public_key: localPub }),
    }).then((r) => r.json());

    if (!out.ok) throw new Error(out.error || "failed to set contact public key");
    return true;
  }

  async function generateContactKeys() {
    setBusy(true);
    setDownloadUrl("");
    setEncryptedUrl("");
    setErrorMsg("");
    try {
      setStatus("Generating keys…");
      const kp = await crypto.subtle.generateKey(
        { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
        true,
        ["encrypt", "decrypt"]
      );

      const spki = new Uint8Array(await crypto.subtle.exportKey("spki", kp.publicKey));
      const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", kp.privateKey));

      localStorage.setItem("uac_contact_pub_spki_b64", b64(spki));
      localStorage.setItem("uac_contact_priv_pkcs8_b64", b64(pkcs8));

      setStatus("Saving public key…");
      await ensureContactPublicKey();

      const dbPub = lookup?.contact?.public_key || "";
      const localPub = localStorage.getItem("uac_contact_pub_spki_b64") || "";
      if (dbPub && localPub && dbPub !== localPub) {
        throw new Error(
          "Key mismatch: this device does not have the private key that matches the public key saved for this contact. Use the original device/browser that generated the keys, or clear keys and regenerate, then have the owner re-create the envelope."
        );
      }


      setStatus("Contact keys generated and saved on this device.");
    } catch (e: any) {
      setStatus("Failed to generate/save keys.");
      setErrorMsg(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function downloadAndDecrypt() {
    setBusy(true);
    setDownloadUrl("");
    try {
      setStatus("Preparing…");
      await ensureContactPublicKey();

      const dbPub = lookup?.contact?.public_key || "";
      const localPub = localStorage.getItem("uac_contact_pub_spki_b64") || "";
      if (dbPub && localPub && dbPub !== localPub) {
        throw new Error(
          "key_mismatch: this browser/device does not have the private key that matches the public key saved for this contact. Use the original device/browser that generated the keys, or clear keys and regenerate, then have the owner re-create the envelope."
        );
      }

      setStatus("Loading private key…");
      const privB64 = localStorage.getItem("uac_contact_priv_pkcs8_b64") || "";
      if (!privB64) throw new Error("missing_private_key: generate contact keys on this device first.");

      const privKey = await crypto.subtle.importKey(
        "pkcs8",
        unb64(privB64),
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["decrypt"]
      );

      setStatus("Fetching envelope…");
      const env: EnvelopeRes = await fetch("/files/share-get-contact-envelope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      }).then((r) => r.json());

      if (!env.ok) throw new Error(env.error || "no_contact_envelope");

      const meta = (()=>{try{return typeof (env as any).meta_json==="string"?JSON.parse(String((env as any).meta_json)):(env as any).meta_json;}catch{return null;}})();

      const ivB64 = meta?.iv_b64;
      const isChunked = !!(meta && (((meta as any).chunked === true) || (meta as any).chunk_meta || (meta as any).chunkMeta));
      if (!ivB64 && !isChunked) throw new Error("missing_iv: envelope meta_json.iv_b64 is missing.");

      setStatus("Unwrapping key…");
      const wrappedB64Raw = String(env.enc_key_b64 || "");
      const wrappedB64 = wrappedB64Raw.replace(/\s+/g,"").replace(/-/g,"+").replace(/_/g,"/");
      const wrappedB64Padded = wrappedB64 + "===".slice((wrappedB64.length + 3) % 4);
      const wrappedAes = unb64(wrappedB64Padded);
      let rawAes: Uint8Array;
      try {
        rawAes = new Uint8Array(await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privKey, wrappedAes));
      } catch (e) {
        throw new Error("unwrap_failed: RSA unwrap failed (wrong private key for this contact, or envelope was created for a different keypair).");
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
      const encRes = await fetch(dl.url);
      if (!encRes.ok) throw new Error("download_failed: could not download encrypted bytes.");

      const ciphertext = new Uint8Array(await encRes.arrayBuffer());
      const ivRaw = String(ivB64 || "");
      const ivClean = ivRaw.replace(/\s+/g,"").replace(/-/g,"+").replace(/_/g,"/");
      const ivPadded = ivClean + "===".slice((ivClean.length + 3) % 4);
      const iv = unb64(ivPadded);

setStatus("Decrypting…");
let plaintext: Uint8Array;

try {
  plaintext = await decryptUacBytes(aesKey, ciphertext);
} catch (e: any) {
  if (!ivB64) throw new Error("missing_iv: envelope meta_json.iv_b64 is missing.");
  try {
    plaintext = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, ciphertext));
  } catch {
    throw new Error("decrypt_failed: AES-GCM failed (ciphertext/iv/key mismatch).");
  }
}

      const blob = new Blob([plaintext], { type: contentType });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setStatus("Decrypted. Use the download button.");
    } catch (e: any) {
      const name = String(e?.name || "");
      const msg = String(e?.message || e || "");
      console.error("[share] downloadAndDecrypt error", e);
      setStatus(`Error: ${name ? name + ": " : ""}${msg}`);
    } finally {
      setBusy(false);
    }
  }
return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-bold">Emergency File Access</h1>
        <p className="mt-2 text-sm opacity-80 break-words">Token: {token}</p>

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
                <div className="mt-1">
                  <span className="opacity-70">Contact:</span> {lookup.contact?.email}
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
              {!hasLocalKeys && (
                <button
                  className="rounded-lg border px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
                  disabled={busy}
                  onClick={generateContactKeys}
                >
                  Generate contact keys on this device
                </button>
              )}

              <button
                className="rounded-lg bg-black text-white px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
                disabled={busy}
                onClick={downloadAndDecrypt}
              >
                Download + decrypt
              </button>

              {encryptedUrl && (
                <a
                  className="rounded-lg border px-4 py-2 text-sm hover:opacity-90 text-center"
                  href={encryptedUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download encrypted file (fallback)
                </a>
              )}

              {downloadUrl && (
                <a className="rounded-lg border px-4 py-2 text-sm hover:opacity-90 text-center" href={downloadUrl} download={filename}>
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
