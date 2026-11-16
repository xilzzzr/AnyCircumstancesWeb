import { ArrowRight, Check, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import type { Scenario } from "@/data/scenarios";

export function ScenarioCard({ scenario, expanded, onToggle, compact = false }: { scenario: Scenario; expanded: boolean; onToggle: () => void; compact?: boolean }) {
  const detailId = `scenario-detail-${scenario.id}`;
  return (
    <article className={`scenario-card scenario-${scenario.tone} ${expanded ? "is-expanded" : ""}`}>
      <div className="scenario-card-main">
        <p className="scenario-number">{scenario.category}</p>
        <p className="mt-3 text-xs text-muted-foreground">{scenario.eyebrow}</p>
        <h3 className="scenario-title"><Link to={`/scenarios#scenario-${scenario.id}`}>{scenario.title}</Link></h3>
        <p className="scenario-situation">{scenario.situation}</p>
        <button className="scenario-open" onClick={onToggle} aria-expanded={expanded} aria-controls={detailId}>{expanded ? "Close" : "Show example setup"}<ChevronDown aria-hidden="true" /></button>
      </div>
      {expanded && (
        <div className="scenario-detail" id={detailId}>
          <div className="scenario-story"><span>What could go wrong</span><p>{scenario.risk}</p></div>
          <div className="scenario-story"><span>How AnyCircumstances helps</span><p>{scenario.help}</p></div>
          <div className="scenario-setup">
            {[['Store', scenario.store], ['Send to', scenario.recipient], ['Release if', scenario.release], ['Result', scenario.result]].map(([label, value]) => (
              <div key={label}><span>{label}</span><p>{value}</p></div>
            ))}
          </div>
          <div className="scenario-actions">
            <Link to="/pricing" className="scenario-primary"><Check /> See plans</Link>
            {!compact && <Link to="/how-it-works">How delivery works <ArrowRight /></Link>}
          </div>
        </div>
      )}
    </article>
  );
}
