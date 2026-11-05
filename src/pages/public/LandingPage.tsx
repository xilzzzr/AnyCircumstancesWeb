import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2, FileLock2, Mail, Timer, UserCheck } from 'lucide-react';
import content from '@/data/publicContent.json';
import { HomeScenarioTeaser } from '@/components/scenarios/HomeScenarioTeaser';
import { ProductTour } from '@/components/public/ProductTour';

const steps = [
  {
    icon: FileLock2,
    title: 'Add files to your vault',
    text: 'Upload documents, account instructions or letters. Each file is encrypted in your browser before it’s uploaded.',
  },
  {
    icon: UserCheck,
    title: 'Choose your emergency contacts',
    text: 'Each person confirms their email address once. You decide which files each of them would receive.',
  },
  {
    icon: Timer,
    title: 'Check in on your schedule',
    text: 'Daily or custom scheduled days, weekly or monthly, with your check-in PIN. Miss one and you get reminder emails during a grace period of 6 to 72 hours that you choose.',
  },
  {
    icon: Mail,
    title: 'If you can’t, they’re emailed',
    text: 'If the grace period runs out, your contacts receive secure links to their files. Until then, they receive nothing.',
  },
];

const reassurance = [
  'Files encrypted in your browser',
  'Each person gets only the files you choose',
  'Reminders and a grace period before anything is sent',
];

export function LandingPage() {
  return (
    <div className="landing-editorial flex flex-col">
      <section className="landing-hero relative overflow-hidden py-20 lg:py-28">
        <div className="absolute inset-0 bg-gradient-hero" />
        <div className="container relative mx-auto px-4">
          <div className="landing-hero-copy hero-reveal mx-auto max-w-4xl text-center">
            <p className="micro-label justify-center"><span className="status-dot" aria-hidden="true" /> {content.home.eyebrow}</p>
            <h1 className="mt-6 text-vault-foreground">{content.home.h1}</h1>
            <p className="mx-auto mt-6 max-w-2xl text-vault-foreground/80">{content.home.intro}</p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="min-h-12 w-full gap-2 sm:w-auto">
                <Link to="/pricing">See plans from $4.99/month <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="min-h-12 w-full border-vault-foreground/30 bg-transparent text-vault-foreground hover:bg-vault-foreground/10 sm:w-auto">
                <Link to="/how-it-works">How it works</Link>
              </Button>
            </div>
            <ul className="mt-10 flex flex-wrap justify-center gap-3" aria-label="Key protections">
              {reassurance.map((item) => (
                <li key={item} className="flex items-center gap-2 rounded-full bg-vault-foreground/5 px-4 py-2 text-sm text-vault-foreground/80">
                  <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-primary" /> {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="steps-title" className="container mx-auto max-w-6xl px-4 py-20 md:py-28">
        <p className="micro-label"><span className="status-dot" aria-hidden="true" /> HOW IT WORKS</p>
        <h2 id="steps-title" className="mt-5 max-w-3xl text-3xl md:text-5xl">{content.home.heading}</h2>
        <p className="mt-5 max-w-3xl text-lg text-muted-foreground">{content.home.sectionIntro}</p>
        <ol className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <li key={step.title} className="rounded-2xl border bg-card p-6">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border" aria-hidden="true">
                  <step.icon className="h-5 w-5 text-primary" />
                </span>
                <span className="text-sm text-muted-foreground">Step {index + 1}</span>
              </div>
              <h3 className="mt-5 text-lg text-foreground">{step.title}</h3>
              <p className="mt-2 leading-7 text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-muted-foreground">
          You also set an emergency PIN. Entering it instead of your check-in PIN sends your contacts their files immediately.{' '}
          <Link to="/how-it-works" className="text-primary underline underline-offset-4">See the full timeline</Link>
        </p>
      </section>

      <ProductTour />

      <section aria-labelledby="switch-title" className="border-t border-white/5 py-20 md:py-28">
        <div className="container mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-2">
          <div>
            <p className="micro-label"><span className="status-dot" aria-hidden="true" /> WHAT IS A DEAD MAN’S SWITCH?</p>
            <h2 id="switch-title" className="mt-5 text-3xl md:text-4xl">A plan that only acts if you stop responding</h2>
          </div>
          <div className="space-y-4 text-lg leading-8 text-muted-foreground">
            <p>
              A dead man’s switch is something that happens automatically unless you keep confirming you’re okay. AnyCircumstances
              applies that idea to your documents: your regular check-ins hold the release back, and only a missed check-in
              followed by an expired grace period lets it through.
            </p>
            <p>
              It doesn’t decide whether something has happened to you. It just follows the schedule you set, which is why the
              reminders and grace period matter.
            </p>
            <p className="flex flex-wrap gap-x-5 gap-y-2 text-base">
              <Link to="/dead-mans-switch" className="text-primary underline underline-offset-4">Online dead man’s switch</Link>
              <Link to="/digital-vault" className="text-primary underline underline-offset-4">Secure digital vault</Link>
              <Link to="/recipients" className="text-primary underline underline-offset-4">What recipients receive</Link>
            </p>
          </div>
        </div>
      </section>

      <HomeScenarioTeaser />

      <section aria-labelledby="trust-title" className="border-t border-white/5 py-20 md:py-28">
        <div className="container mx-auto grid max-w-6xl gap-6 px-4 md:grid-cols-2">
          <article className="rounded-2xl border bg-card p-6 sm:p-8">
            <h2 id="trust-title" className="text-2xl md:text-3xl">Clear about security</h2>
            <p className="mt-4 leading-7 text-muted-foreground">
              Your files are encrypted in your browser, and your vault passphrase never reaches us. So that your contacts can open
              files without your passphrase, the service also keeps an emergency-release key, which means we aren’t
              “zero-knowledge”. The Security page explains exactly what we can and can’t see.
            </p>
            <Link to="/security" className="mt-5 inline-flex min-h-11 items-center gap-2 text-primary underline underline-offset-4">
              Read how your files are protected <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </article>
          <article className="rounded-2xl border bg-card p-6 sm:p-8">
            <h2 className="text-2xl md:text-3xl">Simple pricing</h2>
            <p className="mt-4 leading-7 text-muted-foreground">
              Plans start at $4.99 a month for 5 GB with monthly check-ins. Choose more storage or more frequent check-ins if you
              need them, and pay monthly or yearly. There’s no free plan; you choose a plan before storing files.
            </p>
            <Link to="/pricing" className="mt-5 inline-flex min-h-11 items-center gap-2 text-primary underline underline-offset-4">
              Build your plan <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </article>
        </div>
      </section>
    </div>
  );
}
