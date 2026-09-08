import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Lock,
  Clock,
  Users,
  FileCheck,
  Zap
} from "lucide-react";

const featureList = [
  {
    icon: Lock,
    title: "Client-Side File Encryption",
    description:
      "Files are encrypted locally on your device before upload. The service stores ciphertext and protected recovery-key material for your emergency workflow."
  },
  {
    icon: Clock,
    title: "Automated Check-In System",
    description:
      "Set daily, weekly, or monthly check-ins and configure email reminders. If a check-in is missed, the grace period begins before any recipient delivery occurs."
  },
  {
    icon: Users,
    title: "Trusted Emergency Contacts",
    description:
      "Add the people who should receive specific files if your release conditions are eventually met. Different files can be assigned according to who actually needs them."
  },
  {
    icon: FileCheck,
    title: "Selective File Release",
    description:
      "Choose exactly which documents are included in your emergency release package."
  },
  {
    icon: Zap,
    title: "Conditional Recipient Delivery",
    description:
      "If the configured grace period expires without a successful check-in, designated recipients are emailed secure access to the files assigned to them."
  }
];

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
          <Button asChild className="gap-2"><Link to="/signup">
              Create your vault
              <ArrowRight className="h-4 w-4" />
            </Link></Button>

          <Button asChild variant="outline"><Link to="/pricing">
              Compare pricing plans
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
