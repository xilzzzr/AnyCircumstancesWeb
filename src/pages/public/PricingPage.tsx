import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Check, ArrowRight, Building2, Users, Shield, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const plans = [
  {
    name: 'Starter',
    description: 'Get started with essential protection',
    price: 4.99,
    storage: '5 GB',
    overageRate: 0.75,
    features: [
      'Secure file storage',
      'Inactivity check-ins (daily/weekly/monthly)',
      'Automated delivery to trusted contacts',
      'Email reminders',
      'Optional 2FA',
    ],
    cta: 'Get started',
    popular: false,
    icon: Shield,
  },
  {
    name: 'Plus',
    description: 'More control and priority support',
    price: 12.99,
    storage: '20 GB',
    overageRate: 0.65,
    features: [
      'Everything in Starter',
      'Priority support',
      'Advanced release options',
      'Custom verification schedules',
      'Multiple notification channels',
    ],
    cta: 'Get started',
    popular: true,
    icon: Zap,
  },
  {
    name: 'Commercial',
    description: 'For teams and organizations',
    price: 75,
    storage: '200 GB',
    overageRate: 0.40,
    features: [
      'Everything in Plus',
      'Multi-user / team support',
      'Dedicated onboarding',
      'Team management dashboard',
      'Activity audit logs',
    ],
    cta: 'Get started',
    popular: false,
    icon: Users,
  },
  {
    name: 'Enterprise',
    description: 'Custom solutions for high-volume needs',
    price: null,
    storage: 'Custom',
    overageRate: null,
    features: [
      'Everything in Commercial',
      'Custom storage allocations',
      'Volume-based pricing discounts',
      'Dedicated account manager',
      'Custom SLA',
      'API access',
    ],
    cta: 'Contact us',
    popular: false,
    icon: Building2,
    isEnterprise: true,
  },
];

export function PricingPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="py-16 lg:py-24 bg-gradient-hero">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl font-bold text-vault-foreground mb-6"
            >
              Simple, Transparent Pricing
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg text-vault-foreground/70 mb-6"
            >
              Choose the plan that fits your needs. All plans include end-to-end encryption and no hidden fees.
            </motion.p>

            {/* Monthly billing notice */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-vault-foreground/10 text-vault-foreground/80 text-sm"
            >
              <span className="font-medium">Monthly billing only</span>
              <span className="text-vault-foreground/50">•</span>
              <span>No annual plans</span>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {plans.map((plan, index) => {
              const IconComponent = plan.icon;
              return (
                <motion.div
                  key={plan.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    "relative rounded-2xl p-6 flex flex-col",
                    plan.popular 
                      ? "bg-primary text-primary-foreground ring-2 ring-primary shadow-glow"
                      : "bg-card border border-border"
                  )}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary-foreground text-primary text-xs font-medium">
                      Most Popular
                    </div>
                  )}

                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <IconComponent className={cn(
                        "h-5 w-5",
                        plan.popular ? "text-primary-foreground" : "text-primary"
                      )} />
                      <h3 className={cn(
                        "text-lg font-semibold",
                        plan.popular ? "text-primary-foreground" : "text-foreground"
                      )}>
                        {plan.name}
                      </h3>
                    </div>
                    <p className={cn(
                      "text-sm",
                      plan.popular ? "text-primary-foreground/80" : "text-muted-foreground"
                    )}>
                      {plan.description}
                    </p>
                  </div>

                  <div className="mb-6">
                    {plan.price !== null ? (
                      <>
                        <div className="flex items-baseline gap-1">
                          <span className={cn(
                            "text-4xl font-bold",
                            plan.popular ? "text-primary-foreground" : "text-foreground"
                          )}>
                            ${plan.price}
                          </span>
                          <span className={cn(
                            "text-sm",
                            plan.popular ? "text-primary-foreground/70" : "text-muted-foreground"
                          )}>
                            /month
                          </span>
                        </div>
                        <p className={cn(
                          "text-sm mt-1",
                          plan.popular ? "text-primary-foreground/70" : "text-muted-foreground"
                        )}>
                          {plan.storage} included
                        </p>
                      </>
                    ) : (
                      <div>
                        <span className={cn(
                          "text-2xl font-bold",
                          plan.popular ? "text-primary-foreground" : "text-foreground"
                        )}>
                          Custom Pricing
                        </span>
                        <p className={cn(
                          "text-sm mt-1",
                          plan.popular ? "text-primary-foreground/70" : "text-muted-foreground"
                        )}>
                          Contact us to discuss
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Overage rate */}
                  {plan.overageRate !== null && (
                    <div className={cn(
                      "mb-6 px-3 py-2 rounded-lg text-sm",
                      plan.popular ? "bg-primary-foreground/10" : "bg-muted/50"
                    )}>
                      <span className={plan.popular ? "text-primary-foreground/80" : "text-muted-foreground"}>
                        Overage: 
                      </span>
                      <span className={cn(
                        "font-medium ml-1",
                        plan.popular ? "text-primary-foreground" : "text-foreground"
                      )}>
                        ${plan.overageRate.toFixed(2)}/GB
                      </span>
                      <span className={plan.popular ? "text-primary-foreground/60" : "text-muted-foreground"}>
                        /month
                      </span>
                    </div>
                  )}

                  {/* Enterprise note */}
                  {plan.isEnterprise && (
                    <div className="mb-6 px-3 py-2 rounded-lg bg-muted/50 text-sm">
                      <p className="text-muted-foreground">
                        Larger volume = smaller tariffs
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        Ideal for businesses, law firms, creators
                      </p>
                    </div>
                  )}

                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <Check className={cn(
                          "h-4 w-4 shrink-0 mt-0.5",
                          plan.popular ? "text-primary-foreground" : "text-primary"
                        )} />
                        <span className={plan.popular ? "text-primary-foreground/90" : "text-foreground"}>
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Link to={plan.isEnterprise ? "/contact" : "/signup"}>
                    <Button 
                      className={cn(
                        "w-full",
                        plan.popular && "bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                      )}
                      variant={plan.popular ? "default" : "outline"}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Overage Explanation */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-foreground mb-4">
              How Storage Overage Works
            </h2>
            <p className="text-muted-foreground mb-8">
              Storage overage charges apply only when you exceed your plan's included storage.
            </p>
            
            <div className="grid sm:grid-cols-2 gap-6 text-left">
              <div className="p-6 rounded-xl bg-card border border-border">
                <h3 className="font-semibold text-foreground mb-2">Example</h3>
                <p className="text-sm text-muted-foreground">
                  On the <span className="font-medium text-foreground">Plus plan</span> with 20 GB included, if you use 25 GB:
                </p>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Plan base price</span>
                    <span className="font-medium text-foreground">$12.99</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">5 GB overage × $0.65</span>
                    <span className="font-medium text-foreground">$3.25</span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between">
                    <span className="font-medium text-foreground">Total monthly</span>
                    <span className="font-bold text-primary">$16.24</span>
                  </div>
                </div>
              </div>
              
              <div className="p-6 rounded-xl bg-card border border-border">
                <h3 className="font-semibold text-foreground mb-2">Transparency Promise</h3>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                    <span className="text-muted-foreground">No hidden fees or surprise charges</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                    <span className="text-muted-foreground">Clear usage tracking in your dashboard</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                    <span className="text-muted-foreground">Alerts before you exceed storage</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                    <span className="text-muted-foreground">Upgrade anytime for better rates</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Link */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Have questions about pricing?
            </h2>
            <Link to="/faq">
              <Button variant="outline" className="gap-2">
                View FAQ
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
