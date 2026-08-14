import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Upload, Clock, Users, Bell, Shield, FileCheck } from 'lucide-react';
import { motion } from 'framer-motion';

const steps = [
  {
    number: '01',
    icon: Upload,
    title: 'Upload Your Files',
    description: 'Select the files you want to protect. They are encrypted right on your device using AES-256 encryption before being uploaded to our servers.',
    detail: 'The server stores ciphertext, with protected recovery-key material used for the emergency workflow.',
  },
  {
    number: '02',
    icon: Clock,
    title: 'Set Your Verification Schedule',
    description: 'Choose how often you want to check in: daily, weekly, or monthly. You can adjust this anytime.',
    detail: 'Each verification takes just seconds with PIN or biometric passkey.',
  },
  {
    number: '03',
    icon: Users,
    title: 'Add Emergency Contacts',
    description: 'Designate trusted individuals who will receive your files if you stop responding. They will need to verify their email.',
    detail: 'Contacts are notified only after the verification window expires.',
  },
  {
    number: '04',
    icon: Bell,
    title: 'Stay Active with Check-ins',
    description: 'When it is time to verify, you will receive a notification. Simply enter your PIN or use your passkey to confirm you are okay.',
    detail: 'Missed a check-in? No problem. You have a grace period with reminders.',
  },
  {
    number: '05',
    icon: Shield,
    title: 'Emergency Delivery',
    description: 'If you fail to verify within your window after all reminders, your designated contacts automatically receive secure access to your files.',
    detail: 'They receive a time-limited, secure link to download your encrypted files.',
  },
];

export function HowItWorksPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="py-16 lg:py-24 bg-gradient-hero">
        <div className="container mx-auto px-4">

        <div className="mb-6 text-sm text-muted-foreground">
          <span className="mr-2">Related:</span>
          <Link to="/digital-vault" className="underline underline-offset-4 hover:opacity-90 mr-3">secure digital vault</Link>
          <Link to="/dead-mans-switch" className="underline underline-offset-4 hover:opacity-90">dead man’s switch</Link>
        </div>
          <div className="max-w-3xl mx-auto text-center">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl font-bold text-vault-foreground mb-6"
            >
              How anycircumstances Works
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg text-vault-foreground/70"
            >
              A simple, secure system to ensure your important files reach the right people 
              at the right time.
            </motion.p>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="relative flex gap-8 pb-16 last:pb-0"
              >
                {/* Timeline line */}
                {index < steps.length - 1 && (
                  <div className="absolute left-6 top-16 bottom-0 w-px bg-border" />
                )}

                {/* Icon */}
                <div className="shrink-0">
                  <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center shadow-glow">
                    <step.icon className="h-6 w-6 text-primary-foreground" />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 pt-1">
                  <div className="text-sm font-medium text-primary mb-1">Step {step.number}</div>
                  <h3 className="text-2xl font-bold text-foreground mb-3">{step.title}</h3>
                  <p className="text-muted-foreground mb-4">{step.description}</p>
                  <div className="inline-flex items-start gap-2 px-4 py-3 rounded-lg bg-muted/50 text-sm">
                    <FileCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{step.detail}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Note */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <Shield className="h-12 w-12 text-primary mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-foreground mb-4">
              Your Privacy is Paramount
            </h2>
            <p className="text-muted-foreground mb-8">
              Your files are encrypted before they leave your device, and the service stores
              ciphertext rather than the original file. Protected recovery-key material supports
              the emergency delivery workflow you configure.
            </p>
            <Link to="/security">
              <Button variant="outline" className="gap-2">
                Learn about our security
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-foreground mb-4">
              Ready to get started?
            </h2>
            <p className="text-muted-foreground mb-6">
              Create your secure vault in minutes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/signup">
                <Button size="lg" className="w-full sm:w-auto gap-2">
                  Create account
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/pricing">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  View pricing
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
