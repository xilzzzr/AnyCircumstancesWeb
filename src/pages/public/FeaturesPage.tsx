import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Lock,
  Clock,
  Users,
  FileCheck,
  Zap,
  ShieldAlert
} from "lucide-react";

const featureList = [
  {
    icon: Lock,
    title: "Encryption in your browser",
    description:
      "Each file is encrypted with its own AES-256 key before upload. An emergency-release key lets recipients open files without your passphrase, so the service isn’t zero-knowledge."
  },
  {
    icon: Clock,
    title: "Scheduled check-ins",
    description:
      "Check in daily or on custom scheduled days and times, weekly, or every 30 days with your check-in PIN. Miss one and a grace period of 6 to 72 hours starts, with 1 to 5 reminder emails."
  },
  {
    icon: Users,
    title: "Emergency contacts",
    description:
      "Add the people who should receive files. Each one confirms their email address once, and no account is needed."
  },
  {
    icon: FileCheck,
    title: "Per-person file assignment",
    description:
      "Choose exactly which files each contact receives. Nobody is given your whole vault."
  },
  {
    icon: Zap,
    title: "Secure delivery by email",
    description:
      "When a release happens, each confirmed contact is emailed secure links to their files, which they decrypt in their own browser."
  },
  {
    icon: ShieldAlert,
    title: "Emergency PIN",
    description:
      "A second PIN that looks like a normal check-in but starts delivery immediately, for situations where you can’t wait for the schedule."
  }
];

const planned = ["Phone calls to emergency contacts", "Text messages to emergency contacts", "Location logging at check-in"];

export function FeaturesPage() {
  return (
    <div className="container mx-auto px-4 py-20 max-w-6xl">

        <div className="mb-6 text-sm text-muted-foreground">
          <span className="mr-2">Related:</span>
          <Link to="/digital-vault" className="underline underline-offset-4 hover:opacity-90 mr-3">secure digital vault</Link>
          <Link to="/dead-mans-switch" className="underline underline-offset-4 hover:opacity-90">dead man’s switch</Link>
        </div>

      {/* Hero */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <h1 className="text-4xl md:text-5xl font-bold mb-6">
          Digital emergency vault features
        </h1>

        <p className="text-lg text-muted-foreground mb-8">
          AnyCircumstances is designed to securely store and deliver critical files
          when you cannot. Learn exactly{" "}
          <Link to="/how-it-works" className="underline underline-offset-4">
            how the emergency release system works
          </Link>{" "}
          or review our{" "}
          <Link to="/security" className="underline underline-offset-4">
            encryption and security architecture
          </Link>
          .
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild className="gap-2"><Link to="/pricing">
              See plans from $4.99/month
              <ArrowRight className="h-4 w-4" />
            </Link></Button>

          <Button asChild variant="outline"><Link to="/recipients">
              What recipients receive
            </Link></Button>
        </div>
      </div>

      {/* Feature grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {featureList.map((feature) => (
          <div
            key={feature.title}
            className="p-6 rounded-2xl bg-card border border-border"
          >
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <feature.icon className="h-6 w-6 text-primary" />
            </div>

            <h2 className="text-lg font-semibold mb-2">
              {feature.title}
            </h2>

            <p className="text-muted-foreground">
              {feature.description}
            </p>
          </div>
        ))}
      </div>

      <section aria-labelledby="planned-title" className="mx-auto mt-12 max-w-3xl rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
        <h2 id="planned-title" className="text-base font-semibold text-foreground">Planned, not available yet</h2>
        <p className="mt-2">These aren’t part of any plan today and can’t be purchased: {planned.join(", ").toLowerCase()}. Delivery is currently by email only.</p>
      </section>

      {/* Bottom SEO links */}
      <div className="text-center mt-16 max-w-3xl mx-auto">
        <p className="text-sm text-muted-foreground">
          Want to understand the full workflow? See{" "}
          <Link to="/how-it-works" className="underline underline-offset-4">
            how the automated check-in system works
          </Link>
          , review our{" "}
          <Link to="/security" className="underline underline-offset-4">
            security model
          </Link>
          , or compare{" "}
          <Link to="/pricing" className="underline underline-offset-4">
            secure vault pricing plans
          </Link>
          .
        </p>
      </div>

    </div>
  );
}
