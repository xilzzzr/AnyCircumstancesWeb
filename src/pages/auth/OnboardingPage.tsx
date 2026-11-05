import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Users, Clock, CreditCard, Upload, ArrowRight, Shield } from 'lucide-react';
import { PlanSummary } from '@/components/pricing/PlanSummary';
import { planToSearchParams, pricingHrefForPlan, readPendingPlan } from '@/lib/pendingPlan';

const steps = [
  { title: 'Choose your protection plan', description: 'Choose storage and a check-in frequency. An active plan is required to store files and for automatic delivery.', action: 'Explore plans', icon: CreditCard, href: '/app/plan' },
  { title: 'Set up your check-ins', description: 'Review your schedule, grace period, and reminders before emergency access is triggered.', action: 'Set up verification', icon: Clock, href: '/app/verification' },
  { title: 'Choose your emergency contacts', description: 'Invite the people you trust. They will need to confirm their email before receiving access.', action: 'Add contacts', icon: Users, href: '/app/emergency-contacts' },
  { title: 'Add your first file', description: 'Upload important information, then assign the files each contact should receive.', action: 'Upload a file', icon: Upload, href: '/app/upload' },
];

export function OnboardingPage() {
  // The plan picked on /pricing before signup, if any. Cleared once checkout starts.
  const [pendingPlan] = useState(() => readPendingPlan());
  const planHref = pendingPlan ? `/app/plan?${planToSearchParams(pendingPlan)}` : '/app/plan';

  return (
    <main id="main-content" className="min-h-screen bg-background px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="mb-10 inline-flex items-center gap-3 font-medium text-foreground">
          <span className="public-logo flex h-10 w-10 items-center justify-center rounded-full"><Shield aria-hidden="true" className="h-5 w-5" /></span>
          AnyCircumstances
        </Link>
        <div className="mb-8">
          <p className="text-xs uppercase tracking-widest text-primary/80">Your next steps</p>
          <h1 className="mt-4 text-4xl font-medium tracking-tight text-foreground sm:text-5xl">Make your vault ready.</h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">Your account is created. Follow these steps to decide what gets shared, with whom, and when.</p>
        </div>
        {pendingPlan && (
          <PlanSummary plan={pendingPlan} editHref={pricingHrefForPlan(pendingPlan)} title="The plan you chose" className="mb-8 p-5 sm:p-6">
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              There’s no free plan or trial. Your plan starts when checkout is complete, and you can store files after that.
            </p>
            <Button asChild className="mt-4 w-full min-h-11 rounded-full sm:w-auto">
              <Link to={planHref}>Continue to checkout <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" /></Link>
            </Button>
          </PlanSummary>
        )}
        <ol className="space-y-4">
          {steps.map(({ title, description, action, icon: Icon, href }, index) => {
            const isPlanStep = href === '/app/plan';
            return (
              <li key={href}>
                <Link to={isPlanStep ? planHref : href} className="editorial-card group flex items-start gap-4 p-5 transition-colors hover:bg-white/5 sm:p-6">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/5"><Icon aria-hidden="true" className="h-5 w-5 text-primary" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="mb-2 text-xs text-muted-foreground">Step {index + 1}</p>
                    <h2 className="text-lg font-medium text-foreground">{title}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
                    <span className="mt-4 inline-flex items-center gap-2 text-sm text-primary">{isPlanStep && pendingPlan ? 'Review your plan' : action}<ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
        <div className="mt-8 border-t border-border pt-6">
          <Button asChild variant={pendingPlan ? 'outline' : 'default'} className="w-full min-h-11 rounded-full sm:w-auto"><Link to="/app">Go to dashboard <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" /></Link></Button>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">You can return to this guide or continue from the dashboard at any time. Opening a step does not activate protection.</p>
        </div>
      </div>
    </main>
  );
}
