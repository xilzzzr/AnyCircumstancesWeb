import { useMemo, useState } from "react";
import { ArrowRight, Lightbulb, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { scenarios } from "@/data/scenarios";

const prompts = [
  { text: "Does anyone depend on you or your routines?", ids: ["family", "pets"] },
  { text: "Do you manage accounts, assets, or a business alone?", ids: ["passwords", "crypto", "business"] },
  { text: "Do you travel alone or do higher-risk activities?", ids: ["travel", "high-risk"] },
];

const starterIds = ["family", "passwords", "travel", "business"];

export function IdeasPage() {
  const [answers, setAnswers] = useState<Record<number, boolean>>({});
  const complete = Object.keys(answers).length === prompts.length;
  const suggestions = useMemo(() => {
    const ids = prompts.flatMap((prompt, index) => answers[index] ? prompt.ids : []);
    const selected = Array.from(new Set(ids.length ? ids : starterIds)).slice(0, 4);
    return selected.map((id) => scenarios.find((scenario) => scenario.id === id)).filter(Boolean);
  }, [answers]);

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <div className="micro-label"><Lightbulb className="h-3 w-3" /> VAULT IDEAS</div>
          <h1 className="mt-4 text-3xl lg:text-4xl">What should you prepare?</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">Choose a few answers for a private, on-device shortlist. Nothing is saved or sent.</p>
        </div>

        <Card className="editorial-card">
          <CardHeader><CardTitle>Quick suggestion quiz</CardTitle><CardDescription>Three questions to narrow down a useful first upload.</CardDescription></CardHeader>
          <CardContent className="space-y-1">
            {prompts.map((prompt, index) => (
              <div key={prompt.text} className="flex flex-col gap-3 border-b border-border py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm"><span className="mr-3 text-xs text-muted-foreground">0{index + 1}</span>{prompt.text}</p>
                <div className="flex gap-2" role="group" aria-label={prompt.text}>
                  {[true, false].map((value) => <Button key={String(value)} size="sm" variant={answers[index] === value ? "default" : "outline"} aria-pressed={answers[index] === value} onClick={() => setAnswers((current) => ({ ...current, [index]: value }))}>{value ? "Yes" : "No"}</Button>)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <section aria-live="polite">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div><h2 className="text-xl">{complete ? "Your suggestions" : "Popular starting points"}</h2><p className="mt-1 text-xs text-muted-foreground">Upload instructions or copies of documents—never your only original.</p></div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {suggestions.map((scenario) => scenario && (
              <Card key={scenario.id} className="editorial-card">
                <CardHeader><div className="micro-label">{scenario.category}</div><CardTitle className="text-lg">{scenario.title}</CardTitle><CardDescription>{scenario.store}</CardDescription></CardHeader>
                <CardContent><p className="text-sm text-muted-foreground">Share with: {scenario.recipient}. Release when: {scenario.release.toLowerCase()}.</p></CardContent>
              </Card>
            ))}
          </div>
          <Button asChild className="mt-6 gap-2"><Link to="/app/upload"><Upload className="h-4 w-4" /> Upload something securely <ArrowRight className="h-4 w-4" /></Link></Button>
        </section>
      </div>
    </div>
  );
}
