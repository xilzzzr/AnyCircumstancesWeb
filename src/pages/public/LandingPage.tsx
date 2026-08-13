import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Shield,
  Lock,
  Clock,
  Users,
  ArrowRight,
  CheckCircle2,
  Zap,
  FileCheck,
  KeyRound
} from 'lucide-react';
import { motion } from 'framer-motion';
import { HomeScenarioTeaser } from '@/components/scenarios/HomeScenarioTeaser';

const features = [
  {
    icon: Lock,
    title: 'End-to-End Encryption',
    description: 'Your files are encrypted on your device before upload. We never see your data.',
  },
  {
    icon: Clock,
    title: 'Verification Schedule',
    description: 'Choose daily, weekly, or monthly check-ins. Miss them, and your contacts are notified.',
  },
  {
    icon: Users,
    title: 'Trusted Contacts',
    description: 'Designate who receives your files. They only get access if you stop responding.',
  },
  {
    icon: FileCheck,
    title: 'Selective Sharing',
    description: 'Choose which files are included in your emergency package. Full control.',
  },
  {
    icon: KeyRound,
    title: 'PIN or Passkey',
    description: 'Verify yourself with a simple PIN or biometric passkey. Fast and secure.',
  },
  {
    icon: Zap,
    title: 'Instant Delivery',
    description: 'When triggered, your contacts receive a secure link immediately.',
  },
];

const trustBadges = [
  'Zero-knowledge architecture',
  '256-bit AES encryption',
];

export function LandingPage() {
  return (
    <div className="landing-editorial flex flex-col">
      {/* Hero Section */}
      <section className="landing-hero relative py-24 lg:py-32 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-hero" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.15),transparent_50%)]" />

        <div className="container mx-auto px-4 relative">
          <div className="landing-hero-copy max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">Your data, your terms</span>
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-vault-foreground mb-6 leading-tight"
            >
              Secure emergency data delivery for{' '}
              <span className="gradient-text">when you need it most</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg md:text-xl text-vault-foreground/70 mb-8 max-w-2xl mx-auto"
            >
              Store your important files with end-to-end encryption. Learn exactly how our{' '}
              <Link to="/how-it-works" className="underline underline-offset-4 hover:opacity-90">
                emergency check-in system works
              </Link>
              , review our{' '}
              <Link to="/security" className="underline underline-offset-4 hover:opacity-90">
                zero-knowledge security model
              </Link>
              , or compare{' '}
              <Link to="/pricing" className="underline underline-offset-4 hover:opacity-90">
                secure vault pricing plans
              </Link>
              . If you stop checking in, your trusted contacts automatically receive secure access.
            </motion.p>

            

            <div className="text-base text-vault-foreground/70 mb-8 max-w-2xl mx-auto">
              <span>Use it as a </span><Link to="/digital-vault" className="underline underline-offset-4 hover:opacity-90">secure digital vault</Link><span> and a </span><Link to="/dead-mans-switch" className="underline underline-offset-4 hover:opacity-90">dead man’s switch for encrypted files</Link><span>.</span>
            </div>
<motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link to="/signup">
                <Button size="lg" className="w-full sm:w-auto gap-2 shadow-glow">
                  Get started free
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/how-it-works">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto bg-transparent border-vault-foreground/30 text-vault-foreground hover:bg-vault-foreground/10"
                >
                  See how it works
                </Button>
              </Link>
            </motion.div>

            {/* Trust badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="mt-12 flex flex-wrap justify-center gap-4"
            >
              {trustBadges.map((badge) => (
                <div
                  key={badge}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-vault-foreground/5 text-sm text-vault-foreground/60"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  {badge}
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      <HomeScenarioTeaser />

      {/* Features Section */}
      <section className="landing-features py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Security without complexity
            </h2>
<p className="text-lg text-muted-foreground max-w-2xl mx-auto">
  We've built the most secure way to ensure your important files reach the right people at the right time.
  Explore the full{' '}
  <Link to="/features" className="underline underline-offset-4 hover:opacity-90">
    emergency vault feature set
  </Link>
  , see the full breakdown in{' '}
  <Link to="/security" className="underline underline-offset-4 hover:opacity-90">
    our security page
  </Link>{' '}
  and the step-by-step flow in{' '}
  <Link to="/how-it-works" className="underline underline-offset-4 hover:opacity-90">
    how emergency delivery works
  </Link>
  .
</p>          </div>

          <div className="feature-editorial-grid grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="group p-6 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-300"
              >
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works brief */}
      <section className="landing-process py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Simple. Secure. Reliable.
              </h2>
              <p className="text-lg text-muted-foreground">
                Three steps to peace of mind. If you want more storage, compare plans on{' '}
                <Link to="/pricing" className="underline underline-offset-4 hover:opacity-90">
                  our pricing page
                </Link>
                .
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                { step: '01', title: 'Upload & Encrypt', desc: 'Your files are encrypted locally before they ever leave your device.' },
                { step: '02', title: 'Set Your Schedule', desc: 'Choose how often you want to check in: daily, weekly, or monthly.' },
                { step: '03', title: 'Add Contacts', desc: 'Designate trusted people who will receive access if you stop responding.' },
              ].map((item, index) => (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.15 }}
                  viewport={{ once: true }}
                  className="relative"
                >
                  <div className="text-6xl font-bold text-primary/10 mb-4">{item.step}</div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">{item.title}</h3>
                  <p className="text-muted-foreground">{item.desc}</p>
                </motion.div>
              ))}
            </div>
            <div className="mt-10 text-sm text-muted-foreground text-center">
              Related:{" "}
              <Link to="/features" className="underline underline-offset-4 hover:opacity-90">
                emergency vault features
              </Link>
              {" · "}
              <Link to="/security" className="underline underline-offset-4 hover:opacity-90">
                zero-knowledge security model
              </Link>
              {" · "}
              <Link to="/pricing" className="underline underline-offset-4 hover:opacity-90">
                secure vault pricing plans
              </Link>
              {" · "}
              <Link to="/faq" className="underline underline-offset-4 hover:opacity-90">
                emergency vault FAQ
              </Link>
            </div>



            <div className="mt-12 text-center">
              <Link to="/how-it-works">
                <Button variant="outline" className="gap-2">
                  Learn more about how it works
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
<Link to="/features">
  <Button size="lg" variant="outline">
    Explore security features
  </Button>
</Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="landing-cta py-24 bg-gradient-hero relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(var(--primary)/0.2),transparent_50%)]" />

        <div className="container mx-auto px-4 relative">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-vault-foreground mb-4">
              Ready to secure your legacy?
            </h2>
            <p className="text-lg text-vault-foreground/70 mb-8">
              Start with our free plan. No credit card required.
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

            <p className="mt-6 text-sm text-vault-foreground/70">
              Questions? Read the{' '}
              <Link to="/faq" className="underline underline-offset-4 hover:opacity-90">
                FAQ
              </Link>{' '}
              or review{' '}
              <Link to="/security" className="underline underline-offset-4 hover:opacity-90">
                how we secure your files
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
