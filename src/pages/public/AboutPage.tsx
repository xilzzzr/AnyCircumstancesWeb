import { Link } from "react-router-dom";

const isNot = [
  "It isn’t a will and doesn’t give anyone legal authority over your accounts or property.",
  "It doesn’t decide whether something has happened to you. It only follows the check-in schedule you set.",
  "It isn’t a zero-knowledge service. Files are encrypted in your browser, but an emergency-release key lets the service decrypt files for your recipients.",
  "It isn’t a replacement for keeping originals of important documents somewhere safe.",
];

export function AboutPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-16 md:py-24">
      <p className="micro-label"><span className="status-dot" aria-hidden="true" /> ABOUT</p>
      <h1 className="mt-6 text-4xl text-foreground md:text-6xl">About AnyCircumstances</h1>
      <p className="mt-6 text-lg text-muted-foreground">
        AnyCircumstances helps make sure the people you trust can get to important information when you can’t give it to
        them yourself, whether you’re in hospital, travelling, unreachable or gone.
      </p>

      <section aria-labelledby="what" className="mt-12 space-y-4 leading-7 text-muted-foreground">
        <h2 id="what" className="text-2xl font-semibold text-foreground">What it does</h2>
        <p>
          You keep documents, instructions and letters in an encrypted vault, and choose which file goes to which person. You
          check in on a schedule. If you stop checking in and your grace period runs out, the people you chose are emailed
          secure links to the files you assigned to them. Until then, they receive nothing.
        </p>
        <p>
          Files are encrypted in your browser before upload and stored on Amazon Web Services. Payments on the web go through
          Stripe.
        </p>
      </section>

      <section aria-labelledby="not" className="mt-12">
        <h2 id="not" className="text-2xl font-semibold text-foreground">What it isn’t</h2>
        <ul className="mt-4 list-disc space-y-3 pl-5 leading-7 text-muted-foreground">
          {isNot.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>

      <section aria-labelledby="learn" className="mt-12 space-y-4 leading-7 text-muted-foreground">
        <h2 id="learn" className="text-2xl font-semibold text-foreground">Learn more before you sign up</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          <li><Link to="/how-it-works" className="text-primary underline underline-offset-4">How check-ins and release work</Link></li>
          <li><Link to="/security" className="text-primary underline underline-offset-4">Security and what we can see</Link></li>
          <li><Link to="/recipients" className="text-primary underline underline-offset-4">What your recipients receive</Link></li>
          <li><Link to="/pricing" className="text-primary underline underline-offset-4">Plans and pricing</Link></li>
          <li><Link to="/faq" className="text-primary underline underline-offset-4">Frequently asked questions</Link></li>
          <li><Link to="/terms" className="text-primary underline underline-offset-4">Terms</Link> and <Link to="/privacy" className="text-primary underline underline-offset-4">Privacy Policy</Link></li>
        </ul>
      </section>

      <section aria-labelledby="contact" className="mt-12 rounded-2xl border bg-card p-6 sm:p-8">
        <h2 id="contact" className="text-2xl font-semibold text-foreground">Contact</h2>
        <p className="mt-3 text-muted-foreground">
          Questions about the service, your account or a bill:{" "}
          <a className="text-primary underline underline-offset-4" href="mailto:contact@anycircumstances.com">contact@anycircumstances.com</a>.
        </p>
      </section>
    </div>
  );
}
