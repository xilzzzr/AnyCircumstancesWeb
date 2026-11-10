import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Pages load lazily, so a "#section" target may not exist yet when the route changes.
const ANCHOR_RETRY_MS = 50;
const ANCHOR_MAX_TRIES = 60;

function anchorId(hash: string) {
  if (!hash || hash.length < 2) return null;
  const raw = hash.slice(1);
  // Fragments like "#token=..." carry data for the share page, not an element id.
  if (raw.includes("=")) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

export function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    const id = anchorId(hash);
    if (!id) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      return;
    }

    let tries = 0;
    let timer: number | undefined;
    const scrollToAnchor = () => {
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ block: "start" });
        return;
      }
      tries += 1;
      if (tries < ANCHOR_MAX_TRIES) timer = window.setTimeout(scrollToAnchor, ANCHOR_RETRY_MS);
      else window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    };
    scrollToAnchor();
    return () => window.clearTimeout(timer);
  }, [pathname, hash]);

  return null;
}
