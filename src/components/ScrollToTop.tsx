import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    const titles: Record<string, string> = {
      "/": "AnyCircumstances — Secure Emergency Digital Vault",
      "/features": "Features | AnyCircumstances", "/how-it-works": "How It Works | AnyCircumstances",
      "/pricing": "Pricing | AnyCircumstances", "/security": "Security | AnyCircumstances",
      "/faq": "Frequently Asked Questions | AnyCircumstances", "/contact": "Contact | AnyCircumstances",
      "/terms": "Terms of Service | AnyCircumstances", "/privacy": "Privacy Policy | AnyCircumstances",
      "/accessibility": "Accessibility | AnyCircumstances", "/scenarios": "Ideas and Scenarios | AnyCircumstances",
      "/login": "Log In | AnyCircumstances", "/signup": "Create an Account | AnyCircumstances",
      "/forgot-password": "Forgot Password | AnyCircumstances", "/reset-password": "Reset Password | AnyCircumstances",
      "/verify-email": "Verify Email | AnyCircumstances", "/app": "Dashboard | AnyCircumstances",
    };
    document.title = titles[pathname] || `${pathname.startsWith("/app/") ? "Account" : "Page"} | AnyCircumstances`;
  }, [pathname]);

  return null;
}
