import { useEffect, useId, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowRight, Calendar, Check, HardDrive, Loader2, Receipt } from "lucide-react";
import { motion } from "@/components/public/staticMotion";
import { cn } from "@/lib/utils";
import { createCheckoutSession } from "@/lib/billingClient";
import { loadAuthSession } from "@/lib/authSession";
import {
  checkInFrequencies,
  formatMoney,
  getEffectivePricePerGb,
  getPlanCharge,
  type BillingIntervalId,
  type CheckInFrequencyId,
} from "@/lib/pricing";
import {
  DEFAULT_PLAN,
  clearPendingPlan,
  isBilling,
  isFrequency,
  planFromSearchParams,
  planToSearchParams,
  savePendingPlan,
  type PendingPlan,
} from "@/lib/pendingPlan";
import { StorageSlider } from "@/components/pricing/StorageSlider";
import { PlannedFeaturesNote } from "@/components/pricing/PlannedFeaturesNote";

type AuthState = "unknown" | "authenticated" | "anonymous";
type CheckoutError = { message: string; action?: { href: string; label: string } };

const FREQUENCY_DETAIL: Record<CheckInFrequencyId, string> = {
  monthly: "Check in every 30 days",
  weekly: "Check in every 7 days",
  daily: "Daily or choose a custom check-in calendar",
};

const included = [
  "Encrypted file storage up to the size you choose. Files are encrypted in your browser before upload.",
  "Scheduled check-ins at the frequency you choose.",
  "Email reminders during a grace period you choose, from 6 to 72 hours.",
  "Emergency contacts, and you decide which files each contact receives.",
  "An emergency PIN that sends your verified contacts their files immediately.",
  "Secure links emailed to your verified emergency contacts when delivery happens.",
];

function errorCode(e: unknown): string {
  if (e && typeof e === "object") {
    const data = (e as { data?: { error?: unknown } }).data;
    if (data && typeof data.error === "string") return data.error;
    const message = (e as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "";
}

function checkoutErrorFor(code: string): CheckoutError {
  if (code === "subscription_already_active") {
    return {
      message: "You already have an active plan. You can change it from Billing.",
      action: { href: "/app/billing", label: "Go to Billing" },
    };
  }
  if (code === "invalid_plan") {
    return { message: "That plan selection isn’t valid. Adjust your choices and try again." };
  }
  return { message: "We couldn’t start checkout. You have not been charged. Please try again in a moment." };
}

type ChoiceOption<T extends string> = { value: T; title: string; detail: string; price: string };

function ChoiceCards<T extends string>({
  labelledBy,
  value,
  options,
  onChange,
  isValue,
}: {
  labelledBy: string;
  value: T;
  options: ChoiceOption<T>[];
  onChange: (value: T) => void;
  isValue: (value: unknown) => value is T;
}) {
  const baseId = useId();
  return (
    <RadioGroup
      aria-labelledby={labelledBy}
      value={value}
      onValueChange={(next) => {
        if (isValue(next)) onChange(next);
      }}
      className="space-y-3"
    >
      {options.map((option) => {
        const selected = option.value === value;
        const id = `${baseId}-${option.value}`;
        return (
          <label
            key={option.value}
            htmlFor={id}
            className={cn(
              "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl border p-4 text-left transition",
              selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
            )}
          >
            <RadioGroupItem value={option.value} id={id} />
            <span className="flex flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span>
                <span className="block font-medium text-foreground">{option.title}</span>
                <span className="block text-sm text-muted-foreground">{option.detail}</span>
              </span>
              <span className="text-sm text-muted-foreground">{option.price}</span>
            </span>
          </label>
        );
      })}
    </RadioGroup>
  );
}

export function PricingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const frequencyHeadingId = useId();
  const billingHeadingId = useId();

  const [storageGb, setStorageGb] = useState(DEFAULT_PLAN.storageGb);
  const [frequency, setFrequency] = useState<CheckInFrequencyId>(DEFAULT_PLAN.frequency);
  const [billing, setBilling] = useState<BillingIntervalId>(DEFAULT_PLAN.billing);
  const [authState, setAuthState] = useState<AuthState>("unknown");
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<CheckoutError | null>(null);

  // Restore a selection from ?storage=&frequency=&billing= (e.g. "Edit plan" links).
  // Applied after mount so the prerendered HTML hydrates with the defaults.
  useEffect(() => {
    const fromUrl = planFromSearchParams(location.search);
    if (!fromUrl) return;
    setStorageGb(fromUrl.storageGb);
    setFrequency(fromUrl.frequency);
    setBilling(fromUrl.billing);
  }, [location.search]);

  useEffect(() => {
    let alive = true;
    loadAuthSession()
      .then((session) => {
        if (alive) setAuthState(session?.ok && session.role === "user" ? "authenticated" : "anonymous");
      })
      .catch(() => {
        if (alive) setAuthState("anonymous");
      });
    return () => {
      alive = false;
    };
  }, []);

  const plan: PendingPlan = useMemo(() => ({ storageGb, frequency, billing }), [storageGb, frequency, billing]);
  const charge = useMemo(() => getPlanCharge(storageGb, frequency, billing), [storageGb, frequency, billing]);
  const planQuery = planToSearchParams(plan);
  const isAnnual = billing === "annual";
  const isLoggedIn = authState === "authenticated";

  const frequencyOptions: ChoiceOption<CheckInFrequencyId>[] = checkInFrequencies.map((f) => ({
    value: f.id,
    title: f.label,
    detail: FREQUENCY_DETAIL[f.id],
    price: f.price === 0 ? "Included" : `+${formatMoney(f.price)}/month`,
  }));

  const billingOptions: ChoiceOption<BillingIntervalId>[] = [
    { value: "monthly", title: "Monthly", detail: "Billed every month, renews monthly", price: `${formatMoney(charge.monthlyTotal)}/month` },
    {
      value: "annual",
      title: "Annual",
      detail: "10 × the monthly price, billed once a year, renews yearly",
      price: `${formatMoney(getPlanCharge(storageGb, frequency, "annual").amount)}/year`,
    },
  ];

  const goToSignup = () => {
    savePendingPlan(plan);
    navigate(`/signup?${planQuery}`);
  };

  const startCheckout = async (allowRetry: boolean): Promise<void> => {
    try {
      const data = await createCheckoutSession({
        storageGb,
        checkInFrequency: frequency,
        billingInterval: billing,
        addons: [],
      });
      if (!data?.url) throw new Error("checkout_url_missing");
      clearPendingPlan();
      window.location.href = data.url;
    } catch (e) {
      const code = errorCode(e);
      if (code === "not_authenticated" || code === "invalid_session") {
        if (allowRetry && code === "not_authenticated") {
          const session = await loadAuthSession().catch(() => null);
          if (session?.ok && session.role === "user") return startCheckout(false);
        }
        setAuthState("anonymous");
        goToSignup();
        return;
      }
      setCheckoutError(checkoutErrorFor(code));
      setSubmitting(false);
    }
  };

  const onPrimary = async () => {
    if (submitting) return;
    setCheckoutError(null);
    if (authState === "anonymous") {
      goToSignup();
      return;
    }
    setSubmitting(true);
    await startCheckout(true);
  };

  return (
    <div className="flex flex-col">
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
              Secure Digital Vault Pricing
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg text-vault-foreground/70 mb-6"
            >
              Choose the storage and check-in frequency that fit your plan. Monthly check-ins are included, with weekly and daily options available for people who want a shorter verification interval.
            </motion.p>
          </div>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid lg:grid-cols-5 gap-8">
              <div className="lg:col-span-3 space-y-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 rounded-2xl bg-card border border-border"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <HardDrive aria-hidden="true" className="w-5 h-5 text-muted-foreground" />
                    <h2 className="text-lg font-semibold text-foreground">Storage</h2>
                  </div>
                  <p className="text-sm text-muted-foreground mb-6">The more storage you choose, the lower your price per GB.</p>

                  <div className="mb-4">
                    <div className="flex flex-wrap justify-between items-baseline gap-x-3 gap-y-1 mb-2">
                      <span className="text-3xl font-bold text-foreground">{storageGb} GB</span>
                      <span className="text-sm text-muted-foreground">
                        {formatMoney(charge.storage)}/month · ≈ {formatMoney(getEffectivePricePerGb(storageGb))} per GB
                      </span>
                    </div>
                    <StorageSlider value={storageGb} onChange={setStorageGb} className="my-2" />
                    <div className="flex justify-between text-xs text-muted-foreground" aria-hidden="true">
                      <span>5 GB</span>
                      <span>200 GB</span>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="p-6 rounded-2xl bg-card border border-border"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar aria-hidden="true" className="w-5 h-5 text-muted-foreground" />
                    <h2 id={frequencyHeadingId} className="text-lg font-semibold text-foreground">Check-in frequency</h2>
                  </div>
                  <p className="text-sm text-muted-foreground mb-6">How often you confirm you’re okay. Monthly is included.</p>
                  <ChoiceCards<CheckInFrequencyId>
                    labelledBy={frequencyHeadingId}
                    value={frequency}
                    options={frequencyOptions}
                    onChange={setFrequency}
                    isValue={isFrequency}
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="p-6 rounded-2xl bg-card border border-border"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Receipt aria-hidden="true" className="w-5 h-5 text-muted-foreground" />
                    <h2 id={billingHeadingId} className="text-lg font-semibold text-foreground">Billing</h2>
                  </div>
                  <p className="text-sm text-muted-foreground mb-6">Annual billing costs 10 times the monthly price and covers 12 months.</p>
                  <ChoiceCards<BillingIntervalId>
                    labelledBy={billingHeadingId}
                    value={billing}
                    options={billingOptions}
                    onChange={setBilling}
                    isValue={isBilling}
                  />
                </motion.div>

                <PlannedFeaturesNote />
              </div>

              <div className="lg:col-span-2">
                <div className="sticky top-24 p-6 rounded-2xl bg-card border border-border">
                  <h2 className="text-lg font-semibold text-foreground mb-4">Summary</h2>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Storage ({storageGb} GB)</span>
                      <span className="text-foreground">{formatMoney(charge.storage)}/month</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Check-ins ({frequency === "monthly" ? "Monthly" : frequency === "weekly" ? "Weekly" : "Daily / scheduled"})</span>
                      <span className="text-foreground">{charge.frequency === 0 ? "Included" : `+${formatMoney(charge.frequency)}/month`}</span>
                    </div>

                    <div aria-live="polite" aria-atomic="true" className="border-t border-border pt-3">
                      <div className="flex justify-between gap-3">
                        <span className="font-medium text-foreground">Total</span>
                        <span className="font-semibold text-foreground">
                          {isAnnual ? `${formatMoney(charge.amount)} per year` : `${formatMoney(charge.amount)} per month`}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {isAnnual
                          ? `Charged once a year up front (10 × ${formatMoney(charge.monthlyTotal)}) and renews automatically every year. USD.`
                          : "Charged every month and renews automatically every month. USD."}
                      </p>
                    </div>
                  </div>

                  <Button className="w-full mt-6 min-h-11" onClick={onPrimary} disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 aria-hidden="true" className="w-4 h-4 mr-2 animate-spin" /> Starting checkout…
                      </>
                    ) : (
                      <>
                        {isLoggedIn ? "Continue to checkout" : "Create an account to continue"}
                        <ArrowRight aria-hidden="true" className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>

                  {checkoutError && (
                    <div role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground">
                      <p>{checkoutError.message}</p>
                      {checkoutError.action && (
                        <Link to={checkoutError.action.href} className="mt-1 inline-flex min-h-11 items-center text-primary underline underline-offset-4">
                          {checkoutError.action.label}
                        </Link>
                      )}
                    </div>
                  )}

                  {!isLoggedIn && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      You’ll create your account and set up your PINs first. Payment comes after account setup.{" "}
                      Already have an account?{" "}
                      <Link
                        to={`/login?next=${encodeURIComponent(`/app/plan?${planQuery}`)}`}
                        className="inline-flex min-h-11 items-center text-primary underline underline-offset-4"
                      >
                        Log in
                      </Link>
                    </p>
                  )}

                  <div className="mt-6 space-y-3 text-sm text-muted-foreground">
                    <p>
                      Cancel from Account settings at any time. Cancelling ends your plan immediately and permanently deletes your stored files. Payments are non-refundable except where required by law — see{" "}
                      <Link to="/terms" className="text-primary underline underline-offset-4">Terms</Link>.
                    </p>
                    <p>There’s no free plan or trial — you choose a plan before storing files.</p>
                  </div>
                </div>
              </div>
            </div>

            <section aria-labelledby="pricing-details-heading" className="mt-12 grid gap-6 md:grid-cols-2">
              <h2 id="pricing-details-heading" className="md:col-span-2 text-2xl font-semibold text-foreground">How pricing works</h2>

              <div className="p-6 rounded-2xl bg-card border border-border md:col-span-2">
                <h3 className="text-base font-semibold text-foreground mb-3">What every plan includes</h3>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {included.map((item) => (
                    <li key={item} className="flex gap-3 text-sm text-muted-foreground">
                      <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-6 rounded-2xl bg-card border border-border">
                <h3 className="text-base font-semibold text-foreground mb-3">Monthly or annual billing</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Monthly plans are billed every month and renew automatically each month. Annual plans cost 10 times the monthly price, are billed once a year up front, and renew automatically every year. All prices are in US dollars (USD).
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-card border border-border">
                <h3 className="text-base font-semibold text-foreground mb-3">Storage limit</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Your storage size is the most your encrypted files can add up to in your vault. An upload that would take you over the limit is refused. You can pick any size from 5 GB to 200 GB in 5 GB steps, and the price per GB falls as the size grows.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-card border border-border">
                <h3 className="text-base font-semibold text-foreground mb-3">Check-in frequency</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  This is how often you must check in. Monthly (every 30 days) is included in the storage price. Weekly adds {formatMoney(1.99)} a month and daily adds {formatMoney(2.99)} a month, for people who want a shorter interval before reminders and emergency delivery begin.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-card border border-border">
                <h3 className="text-base font-semibold text-foreground mb-3">Cancelling and payments</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Cancel from Account settings at any time. Cancelling ends your plan immediately and permanently deletes your stored files. If a renewal payment fails, access to your vault is paused right away. Payments are non-refundable except where required by law — see{" "}
                  <Link to="/terms" className="text-primary underline underline-offset-4">Terms</Link>.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-card border border-border md:col-span-2">
                <h3 className="text-base font-semibold text-foreground mb-3">No free plan or trial</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  There’s no free plan or trial — you choose a plan before storing files. Without an active plan you can’t upload, store or download files, or add emergency contacts. See{" "}
                  <Link to="/security" className="text-primary underline underline-offset-4">Security</Link> for how encryption and emergency release work.
                </p>
              </div>
            </section>
          </div>
        </div>
      </section>
    </div>
  );
}
