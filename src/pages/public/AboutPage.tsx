import { Link } from "react-router-dom";

export function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
          About AnyCircumstances
        </h1>

        <p className="text-lg text-muted-foreground mb-6">
          AnyCircumstances is a secure digital vault and dead man’s switch for your most important files.
          Your data is encrypted before upload, and your trusted contacts only receive access if you stop checking in.
        </p>

        <p className="text-lg text-muted-foreground mb-8">
          Learn more about{" "}
          <Link to="/features" className="underline underline-offset-4 hover:opacity-90">
            emergency vault features
          </Link>
          , our{" "}
          <Link to="/security" className="underline underline-offset-4 hover:opacity-90">
            zero-knowledge security model
          </Link>
          , and{" "}
          <Link to="/how-it-works" className="underline underline-offset-4 hover:opacity-90">
            how emergency delivery works
          </Link>
          .
        </p>

        <div className="flex flex-wrap gap-3">
          <Link to="/pricing" className="underline underline-offset-4 hover:opacity-90">
            View secure vault pricing plans
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link to="/faq" className="underline underline-offset-4 hover:opacity-90">
            Read the emergency vault FAQ
          </Link>
        </div>
      </div>
    </div>
  );
}
