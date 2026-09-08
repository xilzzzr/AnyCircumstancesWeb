import { Link } from "react-router-dom";
import { HelpCircle } from "lucide-react";
import { faqs } from "@/data/faqs";

export default function FaqPage() {
  return <div className="container mx-auto max-w-3xl px-4 py-16">
    <header className="text-center"><HelpCircle aria-hidden="true" className="mx-auto mb-6 h-12 w-12 text-primary" /><h1 className="text-4xl font-bold md:text-5xl">Frequently Asked Questions</h1><p className="mt-6 text-xl text-muted-foreground">Find answers to common questions about our service.</p></header>
    <div className="my-8 flex flex-wrap gap-5 text-sm"><Link to="/digital-vault" className="text-primary underline underline-offset-4">secure digital vault</Link><Link to="/dead-mans-switch" className="text-primary underline underline-offset-4">dead man’s switch</Link></div>
    <section aria-label="Frequently Asked Questions" className="space-y-4">{faqs.map(faq => <details key={faq.question} className="rounded-2xl border bg-card p-5 sm:p-6"><summary className="cursor-pointer text-lg font-medium"><h2 className="inline text-lg">{faq.question}</h2></summary><p className="mt-5 leading-7 text-muted-foreground">{faq.answer}</p></details>)}</section>
  </div>;
}
