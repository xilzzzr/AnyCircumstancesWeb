import { Link } from "react-router-dom";
import { Mail } from "lucide-react";

const topics = [
  { title: "Account, billing or sign-in help", text: "Send your message from the email address on your account so we can find it." },
  { title: "Received an emergency email?", text: "Each link opens one file and works once.", link: { to: "/recipients", label: "What recipients should do" } },
  { title: "Security concern", text: "Tell us what you found and how to reproduce it. Please don’t test against other people’s accounts." },
  { title: "Accessibility barrier", text: "Tell us the page, your device and any assistive technology you use.", link: { to: "/accessibility", label: "Accessibility" } },
];

export function ContactPage() {
  return (
    <div className="container mx-auto px-4 py-16 md:py-24">
      <div className="contact-panel mx-auto max-w-3xl">
        <p className="micro-label"><span className="status-dot" aria-hidden="true" /> SUPPORT</p>
        <h1 className="mt-6 text-4xl md:text-6xl">How can we help?</h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Questions about your vault, account or subscription are welcome. We reply by email.
        </p>
        <a className="contact-email mt-8" href="mailto:contact@anycircumstances.com">
          <Mail aria-hidden="true" className="h-4 w-4" />
          contact@anycircumstances.com
        </a>
        <p className="mt-6 text-sm text-muted-foreground">
          Never email passwords, your vault passphrase, PINs, emergency links or private documents.
        </p>
      </div>

      <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
        {topics.map((topic) => (
          <section key={topic.title} className="rounded-2xl border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground">{topic.title}</h2>
            <p className="mt-2 leading-7 text-muted-foreground">{topic.text}</p>
            {topic.link && <Link to={topic.link.to} className="mt-3 inline-block text-primary underline underline-offset-4">{topic.link.label}</Link>}
          </section>
        ))}
      </div>

      <p className="mx-auto mt-10 max-w-3xl text-muted-foreground">
        You may find a faster answer in the <Link to="/faq" className="text-primary underline underline-offset-4">FAQ</Link>, or
        check whether the service is responding on the <Link to="/status" className="text-primary underline underline-offset-4">status page</Link>.
      </p>
    </div>
  );
}
