import { beforeEach, describe, expect, test } from "vitest";
import {
  PENDING_PROMO_STORAGE_KEY,
  clearPendingPromoCode,
  normalizedPromoCode,
  readPendingPromoCode,
  savePendingPromoCode,
} from "@/lib/pioneerPromoStorage";

describe("single-use Pioneer code transport", () => {
  beforeEach(() => { window.sessionStorage.clear(); });

  test("keeps a normalized code in session storage through signup, not the URL", () => {
    expect(savePendingPromoCode(" pioneerabc123 ")).toBe(true);
    expect(readPendingPromoCode()).toBe("PIONEERABC123");
    const saved = JSON.parse(window.sessionStorage.getItem(PENDING_PROMO_STORAGE_KEY) || "{}");
    expect(saved.code).toBe("PIONEERABC123");
    clearPendingPromoCode();
    expect(readPendingPromoCode()).toBe("");
  });

  test("rejects malformed, too-long or expired pending codes", () => {
    expect(normalizedPromoCode("abc;drop")).toBe("");
    expect(normalizedPromoCode("z".repeat(41))).toBe("");
    expect(savePendingPromoCode("bad code")).toBe(false);
    expect(readPendingPromoCode()).toBe("");
    window.sessionStorage.setItem(PENDING_PROMO_STORAGE_KEY,
      JSON.stringify({ code: "PIONEERABC", savedAt: Date.now() - 2 * 24 * 60 * 60 * 1000 }));
    expect(readPendingPromoCode()).toBe("");
    expect(window.sessionStorage.getItem(PENDING_PROMO_STORAGE_KEY)).toBeNull();
  });

  test("invalidated code cannot linger after user deletes or clears it", () => {
    savePendingPromoCode("PIONEERABC");
    expect(savePendingPromoCode("")).toBe(true);
    expect(readPendingPromoCode()).toBe("");
  });
});
