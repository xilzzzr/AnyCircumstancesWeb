import { act, render } from "@testing-library/react";
import { useEffect, useState } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ScrollToTop } from "@/components/ScrollToTop";

// Simulates a lazily loaded page whose sections appear after a short delay.
function SlowPage() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 120);
    return () => window.clearTimeout(timer);
  }, []);
  return ready ? <section id="recovery">Recovery</section> : <p>Loading</p>;
}

function renderAt(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <ScrollToTop />
      <Routes>
        <Route path="/security" element={<SlowPage />} />
        <Route path="/share" element={<p>Share</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ScrollToTop", () => {
  const scrollIntoView = vi.fn();
  const scrollTo = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    scrollIntoView.mockReset();
    scrollTo.mockReset();
    Element.prototype.scrollIntoView = scrollIntoView;
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("scrolls to a #section once the lazily rendered page shows it", async () => {
    renderAt("/security#recovery");
    expect(scrollIntoView).not.toHaveBeenCalled();
    // First the page renders its sections, then the next retry finds the target.
    await act(async () => { vi.advanceTimersByTime(150); });
    await act(async () => { vi.advanceTimersByTime(100); });
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  test("scrolls to the top when there is no #section", () => {
    renderAt("/security");
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "instant" });
  });

  test("treats share-link tokens as data, not a section", () => {
    renderAt("/share#token=abc123");
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "instant" });
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  test("falls back to the top if the section never appears", async () => {
    renderAt("/security#does-not-exist");
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "instant" });
  });
});
