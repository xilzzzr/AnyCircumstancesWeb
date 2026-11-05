import { useId, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { PendingPlan } from "@/lib/pendingPlan";
import { planSummaryParts } from "@/lib/planSummary";

type PlanSummaryProps = {
  plan: PendingPlan;
  /** Where "Edit plan" goes, e.g. pricingHrefForPlan(plan). Omit to hide the link. */
  editHref?: string;
  title?: string;
  className?: string;
  children?: ReactNode;
};

export function PlanSummary({ plan, editHref, title = "Your plan", className, children }: PlanSummaryProps) {
  const headingId = useId();
  const parts = planSummaryParts(plan);

  return (
    <section aria-labelledby={headingId} className={cn("rounded-xl border border-primary/30 bg-primary/5 p-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <h2 id={headingId} className="text-sm font-semibold text-foreground">{title}</h2>
        {editHref && (
          <Link
            to={editHref}
            className="-my-3 inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Edit plan
          </Link>
        )}
      </div>
      <p className="mt-1 text-sm text-foreground">
        {parts.storage} · {parts.checkIns} · <span className="font-semibold">{parts.price}</span>
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {parts.billing.charAt(0).toUpperCase() + parts.billing.slice(1)}. Prices in USD.
      </p>
      {children}
    </section>
  );
}
