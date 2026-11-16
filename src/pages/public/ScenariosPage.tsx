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
      document.getElementById("quiz")?.scrollIntoView({ block: "start" });
    }, 50);
  };

  const shuffle = () => {
    const candidates = filtered.filter((item) => item.id !== expanded);
    const next = candidates[Math.floor(Math.random() * candidates.length)] || filtered[0];
    if (next) { setExpanded(next.id); requestAnimationFrame(() => document.getElementById(`scenario-${next.id}`)?.scrollIntoView({ block: "center" })); }
  };

  return (
    <div className="scenarios-page">

      <section className="scenarios-hero">
        <div className="container mx-auto px-4">
          <span className="micro-label"><span className="status-dot" /> EXAMPLES</span>
          <h1>Examples of what people store<br /><span>and who receives it</span></h1>
          <p>Each example shows what someone might upload, who would receive it, and what triggers delivery. Nothing is sent unless a release happens.</p>
          <div className="flex flex-wrap gap-3 mt-8"><Button onClick={openQuiz}>Take the five-question quiz</Button><Button variant="outline" onClick={shuffle}>Show a random example <RefreshCw /></Button></div>
        </div>
      </section>

      <section className="scenario-library container mx-auto px-4">
        <div className="scenario-filter" role="group" aria-label="Filter scenarios">{categories.map((item) => <button key={item} aria-pressed={category === item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
        <div className="scenario-library-grid">{filtered.map((scenario) => <div id={`scenario-${scenario.id}`} key={scenario.id}><ScenarioCard scenario={scenario} expanded={expanded === scenario.id} onToggle={() => setExpanded(expanded === scenario.id ? null : scenario.id)} /></div>)}</div>
        <div className="scenario-shuffle"><Button variant="outline" onClick={shuffle}><RefreshCw /> Show another example</Button><Link to="/pricing">See plans <ArrowRight /></Link></div>
      </section>

      <section className="scenario-quiz" id="quiz">
        <div className="container mx-auto px-4">
          <div className="quiz-shell">
            <div className="quiz-intro"><span className="micro-label">QUIZ</span><h2>Would AnyCircumstances be useful to you?</h2><p>Five quick questions. No email and no data leaves this page.</p>{!quizOpen && <Button onClick={openQuiz}>Start the quiz <ArrowRight /></Button>}</div>
            {quizOpen && <div className="quiz-questions">
              {questions.map((q, index) => <div className="quiz-question" role="group" aria-labelledby={`quiz-question-${index}`} key={q.text}><div><span aria-hidden="true">0{index + 1}</span><p id={`quiz-question-${index}`}>{q.text}</p></div><div><button aria-pressed={answers[index] === true} className={answers[index] === true ? "selected" : ""} onClick={() => setAnswers({ ...answers, [index]: true })}>Yes</button><button aria-pressed={answers[index] === false} className={answers[index] === false ? "selected" : ""} onClick={() => setAnswers({ ...answers, [index]: false })}>No</button></div></div>)}
              {!complete && <div className="quiz-nudge">Answer all five to see which examples match.</div>}
              {complete && <div className="quiz-result" role="status" aria-live="polite"><span className="micro-label">MATCHING EXAMPLES</span><h3>{resultIds.length} example{resultIds.length === 1 ? "" : "s"} match your answers.</h3>{resultIds.length ? <div>{resultIds.map((id) => { const item = scenarios.find((s) => s.id === id)!; return <button key={id} onClick={() => { setCategory("All"); setExpanded(id); document.getElementById(`scenario-${id}`)?.scrollIntoView(); }}>{item.title}<ArrowRight aria-hidden="true" /></button>; })}</div> : <p>None of the examples match your answers. A basic set of documents and contacts can still help in an emergency.</p>}<Link className="quiz-final-cta" to="/pricing">See plans <ArrowRight aria-hidden="true" /></Link></div>}
            </div>}
          </div>
        </div>
      </section>

      <section className="scenario-final"><div><span className="micro-label">GET STARTED</span><h2>Ready to set up your vault?</h2><p>Plans start at $4.99 a month. You choose the storage, how often you check in, and who receives each file.</p><div><Link to="/pricing">See plans <ArrowRight /></Link><Link to="/how-it-works">How it works</Link></div></div></section>
    </div>
  );
}
