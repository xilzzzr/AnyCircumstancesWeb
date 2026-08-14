import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/seo/Seo";
import { motion } from "framer-motion";
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

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

export function DigitalVaultPage() {
  return (
    <div className="flex flex-col">
      <Seo title="Secure Digital Vault for Important Information | AnyCircumstances" description="Securely store important documents, recovery details, and emergency information, then control when trusted recipients can receive access." path="/digital-vault" />
      <section className="relative py-24 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(var(--primary)/0.12),transparent_55%)]" />

        <div className="container mx-auto px-4 relative">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div {...fadeUp}>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
                <Vault className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">
                  Secure digital vault
                </span>
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.05 }}
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-vault-foreground mb-6 leading-tight"
            >
              A Secure Digital Vault for Important Information
              <span className="block mt-2 text-vault-foreground/80 text-xl md:text-2xl font-medium">
                so future-you (or your people) aren’t stuck guessing.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.12 }}
              className="text-lg md:text-xl text-vault-foreground/70 mb-10 max-w-3xl mx-auto"
            >
              AnyCircumstances is a secure digital vault that encrypts files on
              your device before upload. If you stop checking in, your trusted
              contacts can receive secure access automatically.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.2 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link to="/signup">
                <Button size="lg" className="w-full sm:w-auto gap-2 shadow-glow">
                  Create your vault
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/how-it-works">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto bg-transparent border-vault-foreground/30 text-vault-foreground hover:bg-vault-foreground/10"
                >
                  See how delivery works
                </Button>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.55, delay: 0.35 }}
              className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto"
            >
              {[
                { icon: EyeOff, title: "Ciphertext storage", desc: "Original files are encrypted before upload." },
                { icon: Lock, title: "Encrypted locally", desc: "Encrypted before upload." },
                { icon: BadgeCheck, title: "Controlled access", desc: "Only your rules trigger delivery." },
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
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-background"><div className="container mx-auto max-w-5xl px-4"><h2 className="text-3xl md:text-4xl font-bold">What is a digital vault?</h2><p className="mt-5 max-w-4xl text-lg text-muted-foreground">A digital vault is protected storage for sensitive documents and instructions. A useful vault does more than hold files: it organizes information, limits access, protects recovery, and makes it clear how an authorized person can act when the owner is unavailable.</p><h2 className="mt-14 text-3xl md:text-4xl font-bold">Digital vault, password manager, or cloud storage?</h2><p className="mt-5 text-muted-foreground">Password managers specialize in credentials. Cloud drives specialize in everyday syncing and collaboration. AnyCircumstances is designed for encrypted files plus scheduled check-ins and controlled delivery to trusted contacts. Use each tool for the job it handles best, and avoid duplicating high-risk secrets unnecessarily.</p><div className="mt-10 rounded-2xl border bg-card p-7"><h2 className="text-2xl font-semibold">Planning an emergency file?</h2><p className="mt-3 text-muted-foreground">Use the <Link className="text-primary hover:underline" to="/emergency-information-vault">emergency information vault guide</Link>, follow the <Link className="text-primary hover:underline" to="/guides/emergency-information-checklist">family emergency checklist</Link>, or build a <Link className="text-primary hover:underline" to="/guides/digital-emergency-binder">digital emergency binder</Link>.</p></div></div></section>

      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <motion.div {...fadeUp} className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                What people actually store
              </h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                The stuff that’s impossible to replace, annoying to recover, or stressful to explain on a deadline.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: FileKey2, title: "Recovery phrases", desc: "Crypto seed phrases, backup codes, hardware wallet instructions." },
                { icon: ScrollText, title: "Legal docs", desc: "Wills, powers of attorney, contracts, PDFs you don’t want floating around." },
                { icon: KeyRound, title: "Password backups", desc: "Encrypted exports, “how to access my accounts” instructions." },
                { icon: FileText, title: "Personal directives", desc: "Letters, “what to do if…”, medical/insurance notes, emergency steps." },
                { icon: Users, title: "Family access", desc: "Where key files are, who to contact, what matters most first." },
                { icon: Shield, title: "Anything private", desc: "If it’d be a disaster in the wrong hands, it belongs here." },
              ].map((c, idx) => (
                <motion.div
                  key={c.title}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.05 }}
                  className="p-6 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-lg transition-all"
                >
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <c.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{c.title}</h3>
                  <p className="text-muted-foreground">{c.desc}</p>
                </motion.div>
              ))}
            </div>

            <div className="mt-12 text-center">
              <Link to="/pricing">
                <Button variant="outline" className="gap-2">
                  View pricing plans
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <motion.div {...fadeUp} className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                A vault with an exit plan
              </h2>
              <p className="text-lg text-muted-foreground">
                It’s not just storage. It’s guaranteed delivery under your rules.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                { step: "01", icon: Lock, title: "Encrypt & upload", desc: "Files are encrypted on your device. The server stores ciphertext only." },
                { step: "02", icon: Clock, title: "Set check-ins", desc: "Choose a schedule (daily/weekly/monthly). You stay in control." },
                { step: "03", icon: Users, title: "Choose recipients", desc: "Add trusted contacts. They only get access if you stop responding." },
              ].map((s, idx) => (
                <motion.div
                  key={s.step}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.08 }}
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
                </motion.div>
              ))}
            </div>

            <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/signup">
                <Button size="lg" className="gap-2 shadow-glow">
                  Start free
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/dead-mans-switch">
                <Button size="lg" variant="outline" className="gap-2">
                  Learn about the dead man’s switch
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-gradient-hero relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(var(--primary)/0.2),transparent_55%)]" />
        <div className="container mx-auto px-4 relative">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-vault-foreground mb-4">
              Build your vault in minutes
            </h2>
            <p className="text-lg text-vault-foreground/70 mb-8">
              Start free. Upgrade when you need more storage.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/signup">
                <Button size="lg" className="w-full sm:w-auto gap-2 shadow-glow">
                  Create your vault
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/pricing">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto bg-transparent border-vault-foreground/30 text-vault-foreground hover:bg-vault-foreground/10"
                >
                  View pricing
                </Button>
              </Link>
            </div>

            <p className="mt-6 text-sm text-vault-foreground/60">
              Want the “auto-delivery if I disappear” part? That’s the{" "}
              <Link
                to="/dead-mans-switch"
                className="underline underline-offset-4 hover:opacity-90"
              >
                dead man’s switch
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
