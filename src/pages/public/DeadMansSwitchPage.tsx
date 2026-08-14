import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/seo/Seo";
import { motion } from "framer-motion";
import {
  Skull,
  Clock,
  BellRing,
  Users,
  Lock,
  Shield,
  KeyRound,
  FileKey2,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Zap,
  HeartHandshake,
  MessageCircleWarning,
  TimerReset,
  EyeOff,
  Sparkles,
  Workflow,
} from "lucide-react";

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

export function DeadMansSwitchPage() {
  return (
    <div className="flex flex-col">
      <Seo title="Digital Dead Man’s Switch for Files & Family | AnyCircumstances" description="Use scheduled check-ins to trigger secure delivery of encrypted documents and instructions to trusted contacts if you become unavailable." path="/dead-mans-switch" />
      <section className="relative py-24 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(var(--primary)/0.12),transparent_55%)]" />

        <div className="container mx-auto px-4 relative">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div {...fadeUp}>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
                <Skull className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">
                  Dead man’s switch
                </span>
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.05 }}
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-vault-foreground mb-6 leading-tight"
            >
              A Digital Dead Man’s Switch for Important Files
              <span className="block mt-2 text-vault-foreground/80 text-xl md:text-2xl font-medium">
                automatically, securely, and only to the people you chose.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.12 }}
              className="text-lg md:text-xl text-vault-foreground/70 mb-10 max-w-3xl mx-auto"
            >
              A dead man’s switch is an automated trigger: you prove you’re okay
              on a schedule. Miss your check-ins, and emergency delivery starts.
              It’s like “just in case”… but with fewer sticky notes and panicked
              password guesses.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.2 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link to="/signup">
                <Button size="lg" className="w-full sm:w-auto gap-2 shadow-glow">
                  Set up your switch
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/how-it-works">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto bg-transparent border-vault-foreground/30 text-vault-foreground hover:bg-vault-foreground/10"
                >
                  See the step-by-step flow
                </Button>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.55, delay: 0.35 }}
              className="mt-12 flex flex-wrap justify-center gap-4"
            >
              {[
                { icon: EyeOff, label: "Client-side encrypted files" },
                { icon: TimerReset, label: "Check-ins on your schedule" },
                { icon: BellRing, label: "Automatic delivery on trigger" },
              ].map((b) => (
                <div
                  key={b.label}
                  className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-vault-foreground/5 border border-vault-foreground/10 text-sm text-vault-foreground/70"
                >
                  <b.icon className="h-4 w-4 text-primary" />
                  {b.label}
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="text-3xl md:text-4xl font-bold">What is a dead man’s switch?</h2>
          <p className="mt-5 text-lg text-muted-foreground max-w-4xl">A digital dead man’s switch is an automated system that asks you to check in on a schedule. If you miss the required check-ins and do not respond during the recovery period, the system follows instructions you prepared in advance—such as notifying trusted contacts and releasing selected encrypted files.</p>
          <h2 className="mt-14 text-3xl md:text-4xl font-bold">Useful applications and important limits</h2>
          <div className="mt-7 grid md:grid-cols-2 gap-6">
            <div className="rounded-2xl border bg-card p-6"><h3 className="text-xl font-semibold">Family and important documents</h3><p className="mt-3 text-muted-foreground">Deliver an account map, insurance details, property instructions, or directions to legal originals. Start with the <Link className="text-primary hover:underline" to="/guides/emergency-information-checklist">emergency information checklist</Link>.</p></div>
            <div className="rounded-2xl border bg-card p-6"><h3 className="text-xl font-semibold">Passwords and account recovery</h3><p className="mt-3 text-muted-foreground">Provide protected recovery instructions without leaving a plain-text password list exposed. Read <Link className="text-primary hover:underline" to="/guides/how-to-leave-passwords-to-family">how to leave account access to family</Link>.</p></div>
            <div className="rounded-2xl border bg-card p-6"><h3 className="text-xl font-semibold">Cryptocurrency</h3><p className="mt-3 text-muted-foreground">Document wallets, custody, devices, and recovery paths carefully. A switch does not transfer legal ownership. Review <Link className="text-primary hover:underline" to="/guides/what-happens-to-crypto-when-you-die">what happens to crypto when an owner dies</Link>.</p></div>
            <div className="rounded-2xl border bg-card p-6"><h3 className="text-xl font-semibold">Estate and business continuity</h3><p className="mt-3 text-muted-foreground">A switch can deliver information, but it is not a will, power of attorney, or business succession agreement. Compare a <Link className="text-primary hover:underline" to="/guides/dead-mans-switch-vs-digital-will">dead man’s switch and a digital will</Link>.</p></div>
          </div>
          <h2 className="mt-14 text-3xl md:text-4xl font-bold">Common failure cases</h2>
          <ul className="mt-5 grid gap-3 text-muted-foreground md:grid-cols-2 list-disc pl-6"><li>A check-in schedule is too frequent for real life.</li><li>Reminder messages go to an old address or spam folder.</li><li>Recipients change roles but permissions are not updated.</li><li>Instructions depend on a missing device or second factor.</li><li>Files are outdated or lack enough context.</li><li>A technical release plan is mistaken for legal authority.</li></ul>
        </div>
      </section>

      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <motion.div {...fadeUp} className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Why people set this up
              </h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                Because “I’ll tell them later” is not a real disaster plan.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  icon: FileKey2,
                  title: "Crypto + recovery",
                  desc: "If someone needs seed phrases or recovery codes, they’ll have them.",
                },
                {
                  icon: Users,
                  title: "Family continuity",
                  desc: "Make sure your people can access what matters without chaos.",
                },
                {
                  icon: AlertTriangle,
                  title: "Unexpected events",
                  desc: "Accidents happen. This handles the “what if” part automatically.",
                },
                {
                  icon: HeartHandshake,
                  title: "Trusted delivery",
                  desc: "Choose exactly who gets access and under what conditions.",
                },
                {
                  icon: Lock,
                  title: "Privacy first",
                  desc: "Your files stay encrypted and private until the trigger happens.",
                },
                {
                  icon: Zap,
                  title: "Fast activation",
                  desc: "When triggered, secure links are delivered quickly.",
                },
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
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {c.title}
                  </h3>
                  <p className="text-muted-foreground">{c.desc}</p>
                </motion.div>
              ))}
            </div>

            <div className="mt-12 text-center">
              <Link to="/digital-vault">
                <Button variant="outline" className="gap-2">
                  Learn about the digital vault
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
                How the trigger works
              </h2>
              <p className="text-lg text-muted-foreground">
                A simple schedule + a missed check-in = the start of delivery.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  step: "01",
                  icon: Workflow,
                  title: "Pick a schedule",
                  desc: "Daily, weekly, or monthly. You decide what “normal” looks like.",
                },
                {
                  step: "02",
                  icon: MessageCircleWarning,
                  title: "Check in quickly",
                  desc: "Confirm you’re good. Takes seconds. (Your future self will thank you.)",
                },
                {
                  step: "03",
                  icon: BellRing,
                  title: "Missed check-in triggers delivery",
                  desc: "After your grace rules, contacts receive secure access.",
                },
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
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    {s.title}
                  </h3>
                  <p className="text-muted-foreground">{s.desc}</p>
                </motion.div>
              ))}
            </div>

            <motion.div
              {...fadeUp}
              className="mt-10 p-6 rounded-2xl bg-card border border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mt-0.5">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-foreground font-semibold">Small but important note</div>
                  <div className="text-muted-foreground">
                    Choose a schedule you can keep. The best system is the one you actually use.
                  </div>
                </div>
              </div>
              <Link to="/signup" className="w-full md:w-auto">
                <Button className="w-full md:w-auto gap-2 shadow-glow">
                  Set it up now
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <motion.div
              {...fadeUp}
              className="p-8 md:p-10 rounded-3xl border border-border bg-card relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.12),transparent_55%)]" />
              <div className="relative grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-4">
                    <Shield className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-primary">Built for privacy</span>
                  </div>

                  <h2 className="text-3xl font-bold text-foreground mb-3">
                    No one gets access early
                  </h2>

                  <p className="text-muted-foreground text-lg">
                    Your files stay encrypted and locked until your trigger rules say otherwise.
                  </p>

                  <div className="mt-6 grid gap-3">
                    {[
                      {
                        icon: Lock,
                        t: "Encrypted before upload",
                        d: "The server stores ciphertext, not readable files.",
                      },
                      {
                        icon: EyeOff,
                        t: "Protected recovery design",
                        d: "Encrypted recovery material supports delivery to the contacts you choose.",
                      },
                      {
                        icon: KeyRound,
                        t: "Access stays under your control",
                        d: "Contacts only receive access when the system triggers.",
                      },
                    ].map((x) => (
                      <div key={x.t} className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mt-0.5">
                          <x.icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="text-foreground font-semibold">{x.t}</div>
                          <div className="text-muted-foreground">{x.d}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8">
                    <Link to="/security">
                      <Button variant="outline" className="gap-2">
                        Read security details
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-muted/30 border border-border">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">
                      Practical setup checklist
                    </span>
                  </div>

                  <div className="space-y-3">
                    {[
                      { icon: Clock, t: "Choose a realistic schedule" },
                      { icon: Users, t: "Add 1–3 trusted contacts" },
                      { icon: FileKey2, t: "Attach only the files you want delivered" },
                      { icon: BellRing, t: "Test notifications and confirm routes" },
                    ].map((x) => (
                      <div key={x.t} className="flex items-start gap-3">
                        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center mt-0.5">
                          <x.icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="text-foreground/90">{x.t}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6">
                    <Link to="/signup">
                      <Button className="w-full gap-2 shadow-glow">
                        Set up your switch
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>

                  <div className="mt-4 text-sm text-muted-foreground flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 text-primary" />
                    <span>
                      Tip: Don’t include anything you wouldn’t want delivered if you miss check-ins.
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-gradient-hero relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(var(--primary)/0.2),transparent_55%)]" />
        <div className="container mx-auto px-4 relative">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-vault-foreground mb-4">
              Set it once. Sleep better.
            </h2>
            <p className="text-lg text-vault-foreground/70 mb-8">
              Start free. Add more storage anytime.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/signup">
                <Button size="lg" className="w-full sm:w-auto gap-2 shadow-glow">
                  Set up your switch
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
              Want the storage side too? That’s the{" "}
              <Link
                to="/digital-vault"
                className="underline underline-offset-4 hover:opacity-90"
              >
                secure digital vault
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
