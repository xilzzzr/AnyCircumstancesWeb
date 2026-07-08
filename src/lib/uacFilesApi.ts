export type VaultFile = {
  key: string;
  name: string;
  content_type: string;
  size_bytes: number | null;
  created_at: string;
  include_in_emergency: boolean;
};

type PaywallEventDetail = {
  title?: string;
  description?: string;
  returnTo?: string;
};

function emitPaywall(detail: PaywallEventDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("uac:paywall", { detail }));
}

class ApiError extends Error {
  status: number;
  code: string;
  data: any;

  constructor(code: string, status: number, data: any) {
    super(code);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const code = data?.error ? String(data.error) : `http_${res.status}`;

    if (res.status === 402 || code === "payment_required") {
      const returnTo =
        typeof window !== "undefined" ? window.location.pathname + window.location.search : undefined;

      emitPaywall({
        title: "Paid feature",
        description: "This feature is part of a paid plan. Build a plan starting at $4.99/month to unlock it.",
        returnTo,
      });
    }

    throw new ApiError(code, res.status, data);
  }

  return data as T;
}

export async function listVaultFiles(): Promise<VaultFile[]> {
  const data = await apiJson<{ ok: boolean; files: VaultFile[] }>("/files/list", { method: "GET" });
  return Array.isArray(data.files) ? data.files : [];
}

export async function presignDownload(key: string): Promise<string> {
  const data = await apiJson<{ ok: boolean; url: string }>("/files/presign-download", {
    method: "POST",
    body: JSON.stringify({ key }),
  });
  return String(data.url || "");
}
export async function deleteVaultFile(key: string): Promise<void> {
  await apiJson<{ ok: boolean }>("/files/delete", {
    method: "POST",
    body: JSON.stringify({ key }),
  });
}
