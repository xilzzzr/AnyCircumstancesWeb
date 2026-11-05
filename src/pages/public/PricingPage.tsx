import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Check, ArrowRight, Phone, MessageSquare, MapPin, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { createCheckoutSession } from "@/lib/billingClient";

// Storage tiers with pricing (price per GB decreases as you go higher)
// Max storage price is $29.99 at 200GB
const storageTiers = [
  { gb: 5, price: 4.99, perGb: 1.0 },
  { gb: 10, price: 7.99, perGb: 0.8 },
  { gb: 25, price: 12.99, perGb: 0.52 },
  { gb: 50, price: 17.99, perGb: 0.36 },
  { gb: 100, price: 22.99, perGb: 0.23 },
  { gb: 200, price: 29.99, perGb: 0.15 },
];

const addons = [
  {
    id: "call-contacts",
    label: "Call emergency contacts",
    description: "We'll call your emergency contacts when triggered",
    price: 1.99,
    icon: Phone,
    comingSoon: true,
  },
  {
    id: "text-contacts",
    label: "Text emergency contacts",
    description: "We'll send SMS to your emergency contacts",
    price: 0.49,
    icon: MessageSquare,
    comingSoon: true,
  },
  {
    id: "log-location",
    label: "Log location at check-in",
    description: "Record your GPS location each time you check in",
    price: 0.99,
    icon: MapPin,
    comingSoon: true,
  },
];

const checkInFrequencies = [
  { id: "monthly", label: "Monthly", price: 0.0 },
  { id: "weekly", label: "Weekly", price: 1.99 },
  { id: "daily", label: "Daily", price: 2.99 },
];

function getStoragePrice(gb: number): number {
  for (let i = storageTiers.length - 1; i >= 0; i--) {
    if (gb >= storageTiers[i].gb) {
      if (i === storageTiers.length - 1) return storageTiers[i].price;
      const currentTier = storageTiers[i];
      const nextTier = storageTiers[i + 1];
      const ratio = (gb - currentTier.gb) / (nextTier.gb - currentTier.gb);
      return currentTier.price + ratio * (nextTier.price - currentTier.price);
    }
  }
  return storageTiers[0].price;
}

function getPricePerGb(gb: number): number {
  for (let i = storageTiers.length - 1; i >= 0; i--) {
    if (gb >= storageTiers[i].gb) return storageTiers[i].perGb;
  }
  return storageTiers[0].perGb;
}

export function PricingPage() {
  const [storageGb, setStorageGb] = useState(5);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [checkInFrequency, setCheckInFrequency] = useState("monthly");
  const [isAnnual, setIsAnnual] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoError, setPromoError] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const pricing = useMemo(() => {
    const storagePrice = getStoragePrice(storageGb);
    const addonsPrice = addons
      .filter((addon) => selectedAddons.includes(addon.id))
      .reduce((sum, addon) => sum + addon.price, 0);
    const frequencyPrice = checkInFrequencies.find((f) => f.id === checkInFrequency)?.price || 0;

    const monthlyTotal = storagePrice + addonsPrice + frequencyPrice;
    const annualTotal = monthlyTotal * 10;

    return {
      storage: storagePrice,
      addons: addonsPrice,
      frequency: frequencyPrice,
      monthlyTotal,
      annualTotal,
      annualMonthly: annualTotal / 12,
      savings: monthlyTotal * 2,
    };
  }, [storageGb, selectedAddons, checkInFrequency]);

  const onCheckout = async () => {
    if (checkoutLoading) return;
    setPromoError("");
    setCheckoutLoading(true);
    try {
      const payload: Parameters<typeof createCheckoutSession>[0] = {
        storageGb,
        checkInFrequency: checkInFrequency as "monthly" | "weekly" | "daily",
        billingInterval: isAnnual ? "annual" : "monthly",
        addons: selectedAddons,
        promoCode: promoCode.trim(),
      };

      const data = await createCheckoutSession(payload);
      window.location.href = data.url;
    } catch (e: any) {
      const code = e?.data?.error || e?.message || "";
      if (code === "not_authenticated") {
        localStorage.setItem(
          "pendingCheckout",
          JSON.stringify({
            storageGb,
            checkInFrequency,
            billingInterval: isAnnual ? "annual" : "monthly",
            addons: selectedAddons,
            promoCode: promoCode.trim(),
          })
        );
        window.location.href = "/signup?next=/pricing";
        return;
      }
      setPromoError(code === "invalid_promo_code" ? "This code is invalid or has already been used." : "Unable to start checkout. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const toggleAddon = (addonId: string) => {
    setSelectedAddons((prev) => (prev.includes(addonId) ? prev.filter((id) => id !== addonId) : [...prev, addonId]));
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
                  <h2 className="text-lg font-semibold text-foreground mb-2">Storage</h2>
                  <p className="text-sm text-muted-foreground mb-6">The more storage you choose, the lower your per-GB rate</p>

                  <div className="mb-4">
                    <div className="flex justify-between items-baseline mb-2">
                      <span className="text-3xl font-bold text-foreground">{storageGb} GB</span>
                      <span className="text-sm text-muted-foreground">${getPricePerGb(storageGb).toFixed(2)}/GB</span>
                    </div>
                    <Slider
                      value={[storageGb]}
                      onValueChange={([value]) => setStorageGb(value)}
                      min={5}
                      max={200}
                      step={5}
                      className="my-4"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
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
                    <Calendar className="w-5 h-5 text-muted-foreground" />
                    <h2 className="text-lg font-semibold text-foreground">Check-in Frequency</h2>
                  </div>
                  <p className="text-sm text-muted-foreground mb-6">Choose how often you want to verify you’re okay</p>

                  <div className="space-y-3">
                    {checkInFrequencies.map((freq) => {
                      const selected = checkInFrequency === freq.id;
                      return (
                        <button
                          key={freq.id}
                          type="button"
                          onClick={() => setCheckInFrequency(freq.id)}
                          className={cn(
                            "w-full p-4 rounded-xl border text-left transition",
                            selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-medium text-foreground">{freq.label}</div>
                            <div className="text-sm text-muted-foreground">{freq.price === 0 ? "Included" : `+$${freq.price.toFixed(2)}/mo`}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="p-6 rounded-2xl bg-card border border-border"
                >
                  <h2 className="text-lg font-semibold text-foreground mb-2">Add-ons</h2>
                  <p className="text-sm text-muted-foreground mb-6">Optional features you can add to your plan</p>

                  <div className="space-y-4">
                    {addons.map((addon) => {
                      const checked = selectedAddons.includes(addon.id);
                      const Icon = addon.icon;

                      return (
                        <div
                          key={addon.id}
                          className={cn(
                            "flex items-start gap-4 p-4 rounded-xl border",
                            addon.comingSoon ? "opacity-60" : "hover:bg-muted/40",
                            checked ? "border-primary bg-primary/5" : "border-border"
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => !addon.comingSoon && toggleAddon(addon.id)}
                            disabled={addon.comingSoon}
                            className="mt-1"
                          />

                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <Icon className="w-4 h-4 text-muted-foreground" />
                                <div className="font-medium text-foreground">{addon.label}</div>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {addon.comingSoon ? "Coming soon" : `+$${addon.price.toFixed(2)}/mo`}
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">{addon.description}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              </div>

              <div className="lg:col-span-2">
                <div className="sticky top-24 p-6 rounded-2xl bg-card border border-border">
                  <h2 className="text-lg font-semibold text-foreground mb-4">Summary</h2>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Storage</span>
                      <span className="text-foreground">${pricing.storage.toFixed(2)}/mo</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Check-ins</span>
                      <span className="text-foreground">${pricing.frequency.toFixed(2)}/mo</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Add-ons</span>
                      <span className="text-foreground">${pricing.addons.toFixed(2)}/mo</span>
                    </div>

                    <div className="border-t border-border pt-3 flex justify-between">
                      <span className="font-medium text-foreground">Total</span>
                      <span className="font-semibold text-foreground">
                        {isAnnual ? `$${pricing.annualTotal.toFixed(2)} once/yr` : `$${pricing.monthlyTotal.toFixed(2)}/mo`}
                      </span>
                    </div>

                    {isAnnual && (
                      <div className="text-xs text-muted-foreground">
                        Annual billing: pay for 10 months, get 2 free.
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex items-center justify-between gap-3">
                    <Label htmlFor="annual" className="text-sm text-muted-foreground">
                      Annual billing (pay 10 months, get 2 free)
                    </Label>
                    <Switch id="annual" checked={isAnnual} onCheckedChange={setIsAnnual} />
                  </div>

                  <Button className="w-full mt-6" onClick={onCheckout}>
                    Continue to checkout <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>

                  <div className="mt-4 text-xs text-muted-foreground">
                    Already have an account? <Link to="/login" className="underline">Log in</Link>
                  </div>

                  <div className="mt-6 space-y-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      <span>Cancel anytime</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      <span>Secure by default</span>
                    </div>
                  </div>
                </div>
              </div>
              {/* end summary */}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
