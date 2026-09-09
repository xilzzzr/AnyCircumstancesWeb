import { Link } from "react-router-dom";
import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicContentSection } from "@/components/public/ArticleContent";
import content from "@/data/publicContent.json";

export function HowItWorksPage() {
  const copy = content.how;
  return <div>
    <section className="bg-gradient-hero px-4 py-20 text-vault-foreground md:py-28"><div className="mx-auto max-w-4xl text-center">
      <p className="micro-label">{copy.eyebrow}</p><h1 className="mt-5 text-4xl font-bold md:text-6xl">{copy.h1}</h1><p className="mt-6 text-lg leading-8 text-vault-foreground/75">{copy.intro}</p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Button asChild size="lg"><Link to="/signup">Create Your Vault</Link></Button><Button asChild size="lg" variant="outline"><a href="#timeline">See the Full Timeline</a></Button></div>
    </div></section>
    <PublicContentSection section={copy.sections[0]} id="timeline" />
    <PublicContentSection section={copy.sections[1]} />
    <div className="container mx-auto max-w-5xl px-4 pb-14">
      <div className="mx-auto max-w-xl rounded-2xl border bg-card p-6 text-center"><h3 className="text-xl font-semibold">MISSED CHECK-IN</h3><p className="mt-3 text-muted-foreground">{copy.branch.missed}</p></div>
      <ArrowDown aria-hidden="true" className="mx-auto my-4 text-primary" />
      <div className="mx-auto max-w-xl rounded-2xl border border-primary/40 bg-primary/5 p-6 text-center"><h3 className="text-xl font-semibold">GRACE PERIOD STARTS</h3><p className="mt-3 text-muted-foreground">{copy.branch.grace}</p></div>
      <div className="mt-7 grid gap-6 md:grid-cols-2">{[copy.branch.left, copy.branch.right].map(branch => <div key={branch.heading} className="rounded-2xl border bg-card p-6"><ArrowDown aria-hidden="true" className="mb-4 text-primary" /><h3 className="text-xl font-semibold">{branch.heading}</h3><p className="mt-3 text-muted-foreground">{branch.text}</p></div>)}</div>
    </div>
    {copy.sections.slice(2).map(section => <PublicContentSection key={section.heading} section={section} />)}
  </div>;
}
