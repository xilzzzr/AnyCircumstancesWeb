import { useMemo, useState } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScenarioCard } from "@/components/scenarios/ScenarioCard";
import { categories, scenarios, type ScenarioCategory } from "@/data/scenarios";

const questions = [
  { text: "Do you own anything valuable that only you know how to access?", ids: ["crypto", "private"] },
  { text: "Do you have passwords or accounts nobody else could recover?", ids: ["passwords", "online-business"] },
  { text: "Do you travel alone or spend time away from family?", ids: ["travel", "abroad", "high-risk"] },
  { text: "Does anyone depend on you, including pets?", ids: ["family", "pets"] },
  { text: "Do you run a business, website, or online account someone may need to take over?", ids: ["business", "online-business"] },
];

export function ScenariosPage() {
  const [category, setCategory] = useState<"All" | ScenarioCategory>("All");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<number, boolean>>({});
  const filtered = useMemo(() => category === "All" ? scenarios : scenarios.filter((item) => item.category === category), [category]);
  const resultIds = useMemo(() => Array.from(new Set(questions.flatMap((q, index) => answers[index] ? q.ids : []))).slice(0, 4), [answers]);
  const complete = Object.keys(answers).length === questions.length;

  const openQuiz = () => {
    setQuizOpen(true);
    window.setTimeout(() => {
      document.getElementById("quiz")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const shuffle = () => {
    const candidates = filtered.filter((item) => item.id !== expanded);
    const next = candidates[Math.floor(Math.random() * candidates.length)] || filtered[0];
    if (next) { setExpanded(next.id); requestAnimationFrame(() => document.getElementById(`scenario-${next.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })); }
  };

  return (
    <div className="scenarios-page">

      <section className="scenarios-hero">
        <div className="container mx-auto px-4">
          <span className="micro-label"><span className="status-dot" /> SCENARIO EXPLORER</span>
          <h1>What would happen if<br /><span>you couldn’t explain it tomorrow?</span></h1>
          <p>Recognize a situation, see the risk, and turn it into a simple private plan. Nothing is shared unless your release condition is met.</p>
          <div className="flex flex-wrap gap-3 mt-8"><Button onClick={openQuiz}>Take the 60-second quiz</Button><Button variant="outline" onClick={shuffle}>Show me a situation <RefreshCw /></Button></div>
        </div>
      </section>

      <section className="scenario-library container mx-auto px-4" aria-labelledby="scenario-library-title">
        <h2 id="scenario-library-title" className="sr-only">All scenarios</h2>
        <div className="scenario-filter" role="group" aria-label="Filter scenarios">{categories.map((item) => <button key={item} aria-pressed={category === item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
        <div className="scenario-library-grid">{filtered.map((scenario) => <div id={`scenario-${scenario.id}`} key={scenario.id}><ScenarioCard scenario={scenario} expanded={expanded === scenario.id} onToggle={() => setExpanded(expanded === scenario.id ? null : scenario.id)} /></div>)}</div>
        <div className="scenario-shuffle"><Button variant="outline" onClick={shuffle}><RefreshCw /> Show me another situation</Button><Link to="/signup">I already know what I need <ArrowRight /></Link></div>
      </section>

      <section className="scenario-quiz" id="quiz">
        <div className="container mx-auto px-4">
          <div className="quiz-shell">
            <div className="quiz-intro"><span className="micro-label">PERSONAL READINESS CHECK</span><h2>Would AnyCircumstances be useful to you?</h2><p>Five quick questions. No email and no data leaves this page.</p>{!quizOpen && <Button onClick={openQuiz}>Start the quiz <ArrowRight /></Button>}</div>
            {quizOpen && <div className="quiz-questions">
              {questions.map((q, index) => <div className="quiz-question" role="group" aria-labelledby={`quiz-question-${index}`} key={q.text}><div><span aria-hidden="true">0{index + 1}</span><p id={`quiz-question-${index}`}>{q.text}</p></div><div><button aria-pressed={answers[index] === true} className={answers[index] === true ? "selected" : ""} onClick={() => setAnswers({ ...answers, [index]: true })}>Yes</button><button aria-pressed={answers[index] === false} className={answers[index] === false ? "selected" : ""} onClick={() => setAnswers({ ...answers, [index]: false })}>No</button></div></div>)}
              {!complete && <div className="quiz-nudge">Answer all five to build your personal shortlist.</div>}
              {complete && <div className="quiz-result" role="status" aria-live="polite"><span className="micro-label">YOUR SHORTLIST</span><h3>You found {resultIds.length} situation{resultIds.length === 1 ? "" : "s"} worth preparing for.</h3>{resultIds.length ? <div>{resultIds.map((id) => { const item = scenarios.find((s) => s.id === id)!; return <button key={id} onClick={() => { setCategory("All"); setExpanded(id); document.getElementById(`scenario-${id}`)?.scrollIntoView({ behavior: "smooth" }); }}>{item.title}<ArrowRight aria-hidden="true" /></button>; })}</div> : <p>You may still want a basic document and contact plan for unexpected events.</p>}<Link className="quiz-final-cta" to="/signup">Create my first circumstance <ArrowRight aria-hidden="true" /></Link></div>}
            </div>}
          </div>
        </div>
      </section>

      <section className="scenario-final"><div><span className="micro-label">KEEP IT PRIVATE. KEEP IT READY.</span><h2>You know something important.<br />Someone may eventually need it.</h2><p>You don’t need to give it to them now. You need a trusted way for it to reach them later.</p><div><Link to="/signup">Create a circumstance <ArrowRight /></Link><Link to="/pricing">Compare plans</Link></div></div></section>
    </div>
  );
}
