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
          <div><span className="micro-label"><span className="status-dot" /> REAL-LIFE SCENARIOS</span><h2>Could this happen to you?</h2></div>
          <div><p>Start with the situation—not the software. See what you might prepare, who would receive it, and when.</p><Link to="/scenarios">Explore every situation <ArrowRight /></Link></div>
        </div>
        <div className="scenario-teaser-grid">
          {featured.map((scenario) => <ScenarioCard key={scenario.id} scenario={scenario} compact expanded={expanded === scenario.id} onToggle={() => setExpanded(expanded === scenario.id ? null : scenario.id)} />)}
        </div>
        <div className="scenario-teaser-cta"><p>You don’t have to share everything today. You just need a plan for when someone else needs it.</p><Link to="/scenarios">Find your situations <ArrowRight /></Link></div>
      </div>
    </section>
  );
}
