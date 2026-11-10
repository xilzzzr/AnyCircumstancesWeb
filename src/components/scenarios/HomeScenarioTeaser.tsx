import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { homepageScenarioIds, scenarios } from "@/data/scenarios";
import { ScenarioCard } from "./ScenarioCard";

export function HomeScenarioTeaser() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const featured = homepageScenarioIds.map((id) => scenarios.find((item) => item.id === id)!).filter(Boolean);
  return (
    <section className="scenario-teaser">
      <div className="container mx-auto px-4">
        <div className="scenario-section-head">
          <div><span className="micro-label"><span className="status-dot" /> EXAMPLES</span><h2>Examples of what people store</h2></div>
          <div><p>Each example shows what someone might upload, who would receive it, and what would trigger delivery.</p><Link to="/scenarios">See all examples <ArrowRight /></Link></div>
        </div>
        <div className="scenario-teaser-grid">
          {featured.map((scenario) => <ScenarioCard key={scenario.id} scenario={scenario} compact expanded={expanded === scenario.id} onToggle={() => setExpanded(expanded === scenario.id ? null : scenario.id)} />)}
        </div>
        <div className="scenario-teaser-cta"><p>Nothing is sent to anyone unless you stop checking in or use your emergency PIN.</p><Link to="/scenarios#quiz">Take the five-question quiz <ArrowRight /></Link></div>
      </div>
    </section>
  );
}
