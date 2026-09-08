import { Link, useLocation } from "react-router-dom";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ctaVariants, type CtaVariant } from "@/data/ctas";
import { getPublicRouteSeo } from "@/seo/publicRoutes";

export function ContextualCta({ variant = "general" }: { variant?: CtaVariant }) {
  const copy = ctaVariants[variant];
  return <aside data-cta={variant} className="contextual-cta rounded-3xl border border-primary/20 bg-card p-6 sm:p-9 md:p-12">
    <ShieldCheck aria-hidden="true" className="mb-5 h-8 w-8 text-primary" />
    {"eyebrow" in copy && <p className="micro-label mb-4">{copy.eyebrow}</p>}
    <h2 className="max-w-3xl text-2xl font-semibold sm:text-3xl">{copy.heading}</h2>
    <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">{copy.body}</p>
    <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <Button asChild size="lg" className="h-auto min-h-11 whitespace-normal text-center"><Link to={copy.primaryPath}>{copy.primary}<ArrowRight aria-hidden="true" className="ml-2 h-4 w-4 shrink-0" /></Link></Button>
      <Button asChild size="lg" variant="outline" className="h-auto min-h-11 whitespace-normal text-center"><Link to={copy.secondaryPath}>{copy.secondary}</Link></Button>
    </div>
  </aside>;
}

const routeVariants: Record<string, CtaVariant> = {
  "/dead-mans-switch": "switch", "/digital-vault": "vault", "/emergency-information-vault": "emergency",
  "/contact": "informational", "/privacy": "informational", "/terms": "informational", "/accessibility": "informational",
};

// Use the existing indexable route registry. Utility, private and unknown routes never get a banner.
export function PublicPageCta() {
  const { pathname } = useLocation();
  const path = pathname === "/" ? "/" : pathname.replace(/\/$/, "");
  if (path === "/pricing" || !getPublicRouteSeo(path)) return null;
  return <div className="container mx-auto max-w-5xl px-4 py-16"><ContextualCta variant={routeVariants[path] ?? "general"} /></div>;
}
