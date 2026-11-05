import { useId } from "react";
import { cn } from "@/lib/utils";
import { plannedFeatures } from "@/lib/pricing";

// Features that are not built yet. Deliberately no prices and no checkboxes.
export function PlannedFeaturesNote({ className }: { className?: string }) {
  const titleId = useId();
  return (
    <aside aria-labelledby={titleId} className={cn("rounded-xl border border-dashed border-border p-4", className)}>
      <p id={titleId} className="text-sm font-medium text-muted-foreground">Planned — not available yet</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        These are not part of any plan today and can’t be purchased:
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">
        {plannedFeatures.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
    </aside>
  );
}
