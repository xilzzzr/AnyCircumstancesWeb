// A one-use promotion code is not a login secret, but keep it out of URLs,
// logs and long-lived localStorage while the visitor completes signup.
export const PENDING_PROMO_STORAGE_KEY = "uac.pending_promo.v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function normalizedPromoCode(input: unknown): string {
  if (typeof input !== "string") return "";
  const code = input.trim().toUpperCase();
  return /^[A-Z0-9]{4,40}$/.test(code) ? code : "";
}

export function clearPendingPromoCode(): void {
  try { window.sessionStorage.removeItem(PENDING_PROMO_STORAGE_KEY); }
  catch { /* Storage can be blocked. */ }
}

export function savePendingPromoCode(input: string): boolean {
  const code = normalizedPromoCode(input);
  if (!code) {
    clearPendingPromoCode();
    return !input.trim();
  }
  try {
    window.sessionStorage.setItem(PENDING_PROMO_STORAGE_KEY, JSON.stringify({ code, savedAt: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

export function readPendingPromoCode(): string {
  try {
    const raw = window.sessionStorage.getItem(PENDING_PROMO_STORAGE_KEY);
    if (!raw) return "";
    const saved = JSON.parse(raw) as { code?: unknown; savedAt?: unknown };
    const code = normalizedPromoCode(saved.code);
    const created = Number(saved.savedAt);
    if (!code || !Number.isFinite(created) || Date.now() - created > MAX_AGE_MS || created > Date.now()) {
      clearPendingPromoCode();
      return "";
    }
    return code;
  } catch {
    clearPendingPromoCode();
    return "";
  }
}
