import { Link } from "react-router-dom";
import { faqGroups } from "@/data/faqs";

export default function FaqPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-16 md:py-24">
      <header>
        <p className="micro-label"><span className="status-dot" aria-hidden="true" /> FAQ</p>
        <h1 className="mt-6 text-4xl md:text-6xl">Frequently asked questions</h1>
        <p className="mt-6 text-lg text-muted-foreground">
          Straight answers about security, check-ins, recipients and billing. Can’t find yours? Email{" "}
          <a className="text-primary underline underline-offset-4" href="mailto:contact@anycircumstances.com">contact@anycircumstances.com</a>.
        </p>
        <nav aria-label="FAQ topics" className="mt-8 flex flex-wrap gap-2">
          {faqGroups.map((group) => (
            <a key={group.id} href={`#${group.id}`} className="inline-flex min-h-11 items-center rounded-md border px-4 text-sm text-foreground hover:bg-accent">
              {group.title}
            </a>
          ))}
        </nav>
      </header>

      {faqGroups.map((group) => (
        <section key={group.id} id={group.id} aria-labelledby={`${group.id}-title`} className="mt-14 scroll-mt-24">
          <h2 id={`${group.id}-title`} className="text-2xl font-semibold md:text-3xl">{group.title}</h2>
          <div className="mt-6 space-y-3">
            {group.items.map((faq) => (
              <details key={faq.question} className="group rounded-2xl border bg-card p-5 sm:p-6">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-lg font-medium text-foreground">
                  <h3 className="text-lg font-medium">{faq.question}</h3>
                  <span aria-hidden="true" className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-4 leading-7 text-muted-foreground">{faq.answer}</p>
                {faq.links?.length ? (
                  <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                    {faq.links.map((link) => (
                      <li key={link.to + link.label}>
                        <Link to={link.to} className="text-primary underline underline-offset-4">{link.label}</Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
