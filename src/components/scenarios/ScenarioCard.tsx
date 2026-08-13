import { ArrowRight, Check, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import type { Scenario } from "@/data/scenarios";

export function ScenarioCard({ scenario, expanded, onToggle, compact = false }: { scenario: Scenario; expanded: boolean; onToggle: () => void; compact?: boolean }) {
  const detailId = `scenario-detail-${scenario.id}`;
  return (
    <article className={`scenario-card scenario-${scenario.tone} ${expanded ? "is-expanded" : ""}`}>
      <button className="scenario-card-main" onClick={onToggle} aria-expanded={expanded} aria-controls={detailId}>
        <span className="scenario-number">{scenario.eyebrow}</span>
        <span className="scenario-title">{scenario.title}</span>
        <span className="scenario-situation">{scenario.situation}</span>
        <span className="scenario-open">{expanded ? "Close story" : "See how I’d set this up"}<ChevronDown aria-hidden="true" /></span>
      </button>
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
            <Link to="/signup" className="scenario-primary"><Check /> That’s me — create my plan</Link>
            {!compact && <Link to="/how-it-works">How delivery works <ArrowRight /></Link>}
          </div>
        </div>
      )}
    </article>
  );
}
