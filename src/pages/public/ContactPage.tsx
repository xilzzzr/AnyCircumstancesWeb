import { Mail } from "lucide-react";

export function ContactPage() {
  return (
    <div className="container mx-auto px-4 py-20 lg:py-32">

      <div className="contact-panel max-w-3xl mx-auto text-center">
        <div className="micro-label justify-center"><span className="status-dot" /> SUPPORT CHANNEL</div>
        <h1 className="mt-6 text-4xl md:text-6xl">How can we help?</h1>
        <p className="mt-6 text-muted-foreground max-w-xl mx-auto">
          Questions about your vault, account, or subscription are welcome. Our team will respond by email.
        </p>
        <a className="contact-email mt-10" href="mailto:contact@anycircumstances.com">
          <Mail className="h-4 w-4" />
          contact@anycircumstances.com
        </a>
      </div>
    </div>
  );
}
