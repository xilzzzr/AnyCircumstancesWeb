import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import content from "@/data/publicContent.json";
import { ContextualCta } from "@/components/public/ContextualCta";
import { ContentLinks, PublicContentSection } from "@/components/public/ArticleContent";
import {
  Vault,
  Lock,
  KeyRound,
  Shield,
  Users,
  Clock,
  FileText,
  FileKey2,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Layers,
  Zap,
  BadgeCheck,
  EyeOff,
  AlertTriangle,
  ScrollText,
} from "lucide-react";

export function DigitalVaultPage() {
  return (
    <div className="flex flex-col">
      <section className="relative py-24 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(var(--primary)/0.12),transparent_55%)]" />

        <div className="container mx-auto px-4 relative">
          <div className="max-w-4xl mx-auto text-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary/10 border border-primary/20 mb-6">
                <Vault className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">
                  {content.vault.eyebrow}
                </span>
              </div>
            </div>

            <h1
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-vault-foreground mb-6 leading-tight"
            >{content.vault.h1}</h1>

            <p
              className="text-lg md:text-xl text-vault-foreground/70 mb-10 max-w-3xl mx-auto"
            >{content.vault.intro}</p>

            <div
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Button asChild size="lg" className="w-full sm:w-auto gap-2 shadow-glow"><Link to="/pricing">
                  See plans from $4.99/month
                  <ArrowRight className="h-4 w-4" />
                </Link></Button>
              <Button asChild
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto bg-transparent border-vault-foreground/30 text-vault-foreground hover:bg-vault-foreground/10"
                ><Link to="/how-it-works">
                  See How Delivery Works
                </Link></Button>
            </div>

            <div
              className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto"
            >
              {[
                { icon: EyeOff, title: "Encrypted in your browser", desc: "File contents are encrypted before upload." },
                { icon: Users, title: "Per-person access", desc: "Each contact gets only the files you assign." },
                { icon: BadgeCheck, title: "Released on your rules", desc: "A missed check-in plus grace period, or your emergency PIN." },
              ].map((s) => (
                <div
                  key={s.title}
                  className="p-4 rounded-2xl bg-vault-foreground/5 border border-vault-foreground/10"
                >
                  <div className="flex items-center justify-center gap-2">
                    <s.icon className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-vault-foreground">
                      {s.title}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-vault-foreground/60">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-background"><div className="container mx-auto max-w-5xl px-4"><h2 className="text-3xl md:text-4xl font-bold">What is a digital vault?</h2><p className="mt-5 max-w-4xl text-lg text-muted-foreground">A digital vault is protected storage for sensitive documents and instructions. A useful vault does more than hold files: it organizes information, limits access, protects recovery, and makes it clear how an authorized person can act when the owner is unavailable.</p></div></section><PublicContentSection section={content.vault.sections[0]} /><PublicContentSection section={content.vault.sections[1]} /><PublicContentSection section={{ ...content.vault.sections[2], cards: undefined }} /><div className="container mx-auto max-w-5xl px-4 py-6"><ContextualCta variant="vault" /><ContentLinks links={content.vault.links} /></div><section className="py-14"><div className="container mx-auto max-w-5xl px-4"><h2 className="mt-14 text-3xl md:text-4xl font-bold">Digital vault, password manager, or cloud storage?</h2><p className="mt-5 text-muted-foreground">Password managers specialize in credentials. Cloud drives specialize in everyday syncing and collaboration. AnyCircumstances is designed for encrypted files plus scheduled check-ins and controlled delivery to trusted contacts. Use each tool for the job it handles best, and avoid duplicating high-risk secrets unnecessarily.</p><div className="mt-10 rounded-2xl border bg-card p-7"><h2 className="text-2xl font-semibold">Planning an emergency file?</h2><p className="mt-3 text-muted-foreground">Use the <Link className="text-primary hover:underline" to="/emergency-information-vault">emergency information vault guide</Link>, follow the <Link className="text-primary hover:underline" to="/guides/emergency-information-checklist">family emergency checklist</Link>, or build a <Link className="text-primary hover:underline" to="/guides/digital-emergency-binder">digital emergency binder</Link>.</p></div></div></section>

      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                What people actually store
              </h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                Common examples of files people keep in their vault.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: FileKey2, title: "Crypto recovery instructions", desc: "Where wallets and hardware devices are, and the steps someone would follow to recover them." },
                { icon: ScrollText, title: "Copies of legal documents", desc: "Wills, powers of attorney and contracts, plus where the signed originals are kept." },
                { icon: KeyRound, title: "Account roadmaps", desc: "Which accounts exist, how to reach your password manager, and what to deal with first." },
                { icon: FileText, title: "Personal directives", desc: "Letters, “what to do if…”, medical/insurance notes, emergency steps." },
                { icon: Users, title: "Family access", desc: "Where key files are, who to contact, what matters most first." },
                { icon: Shield, title: "Personal letters", desc: "Messages you want a specific person to receive." },
              ].map((c, idx) => (
                <div
                  key={c.title}
                  className="p-6 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-lg transition-all"
                >
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <c.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{c.title}</h3>
                  <p className="text-muted-foreground">{c.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-12 text-center">
              <Button asChild variant="outline" className="gap-2"><Link to="/pricing">
                  View pricing plans
                  <ArrowRight className="h-4 w-4" />
                </Link></Button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                A vault with a release plan
              </h2>
              <p className="text-lg text-muted-foreground">
                AnyCircumstances combines encrypted storage with configurable check-ins, reminders, a grace period, and trusted-recipient delivery. It is designed to make emergency access deliberate instead of giving someone permanent access in advance.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                { step: "01", icon: Lock, title: "Encrypt & upload", desc: "File contents are encrypted in your browser before upload." },
                { step: "02", icon: Clock, title: "Set check-ins", desc: "Check in daily or on custom scheduled days, weekly or monthly, with reminders and a grace period you choose." },
                { step: "03", icon: Users, title: "Choose recipients", desc: "Contacts confirm their email once, and receive their files only if a release happens." },
              ].map((s, idx) => (
                <div
                  key={s.step}
                  className="p-6 rounded-2xl bg-card border border-border"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-5xl font-bold text-primary/15">{s.step}</div>
                    <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
                      <s.icon className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">{s.title}</h3>
                  <p className="text-muted-foreground">{s.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="gap-2 shadow-glow"><Link to="/pricing">
                  See plans from $4.99/month
                  <ArrowRight className="h-4 w-4" />
                </Link></Button>
              <Button asChild size="lg" variant="outline" className="gap-2"><Link to="/dead-mans-switch">
                  Learn about the dead man’s switch
                  <ArrowRight className="h-4 w-4" />
                </Link></Button>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
