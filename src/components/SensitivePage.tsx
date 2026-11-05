import { useEffect, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";

// A history restore must create fresh components rather than redisplay decrypted content.
// This releases app references; JavaScript cannot promise secure memory erasure.
export function SensitivePage({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(true);
  useEffect(() => {
    const hide = () => flushSync(() => setActive(false));
    const show = () => setActive(true);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    return () => {
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
    };
  }, []);
  return active ? children : null;
}
