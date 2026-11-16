import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Shield, Eye, EyeOff, Loader2, Check, CheckCircle2, Clock3, Siren, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PlanSummary } from '@/components/pricing/PlanSummary';
import { planFromSearchParams, planToSearchParams, pricingHrefForPlan, readPendingPlan, savePendingPlan } from '@/lib/pendingPlan';

const requirements = [
  { label: 'At least 10 characters', check: (p: string) => p.length >= 10 },
  { label: 'One uppercase letter', check: (p: string) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', check: (p: string) => /[a-z]/.test(p) },
  { label: 'One number', check: (p: string) => /\d/.test(p) },
];

export function SignupPage() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  // A plan chosen on /pricing: from the URL first, otherwise from the saved pending plan.
  const [plan] = useState(() => planFromSearchParams(location.search) ?? readPendingPlan());
  const fromUrl = planFromSearchParams(location.search) !== null;

  useEffect(() => {
    if (plan && fromUrl) savePendingPlan(plan);
  }, [plan, fromUrl]);

  const signInHref = plan ? `/login?next=${encodeURIComponent(`/app/plan?${planToSearchParams(plan)}`)}` : '/login';

  const passwordValid = requirements.every(r => r.check(password));
  const passwordsMatch = password === confirmPassword && password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!displayName.trim()) {
      toast({ title: 'Your name is required', description: 'Enter the name your emergency contacts will recognize.', variant: 'destructive' });
      return;
    }

    if (!email) {
      toast({
        title: 'Email required',
        description: 'Please enter your email address.',
        variant: 'destructive',
      });
      return;
    }

    if (!passwordValid) {
      toast({
        title: 'Password requirements not met',
        description: 'Please ensure your password meets all requirements.',
        variant: 'destructive',
      });
      return;
    }

    if (!passwordsMatch) {
      toast({
        title: 'Passwords do not match',
        description: 'Please ensure both passwords are identical.',
        variant: 'destructive',
      });
      return;
    }

    if (!agreedToTerms) {
      toast({
        title: 'Terms required',
        description: 'Please confirm you are at least 13 and agree to the Terms of Service and Privacy Policy.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const resp = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, displayName: displayName.trim(), ageConfirmed: true }),
      });

      let data: { ok?: boolean; error?: string } | null = null;
      try {
        data = await resp.json();
      } catch {
        data = null;
      }

      if (!resp.ok || !data?.ok) {
        const code = data?.error || 'signup_failed';

        if (code === 'email_in_use') {
          toast({
            title: 'Email already in use',
            description: 'Try logging in instead, or use a different email.',
            variant: 'destructive',
          });
          return;
        }

        if (code === 'invalid_email') {
          toast({
            title: 'Invalid email',
            description: 'Please enter a valid email address.',
            variant: 'destructive',
          });
          return;
        }

        if (code === 'weak_password') {
          toast({
            title: 'Password too weak',
            description: 'Please choose a stronger password.',
            variant: 'destructive',
          });
          return;
        }

        toast({
          title: 'Signup failed',
          description: 'Please try again.',
          variant: 'destructive',
        });
        return;
      }

      sessionStorage.setItem('pending_verify_email', email);
      toast({
        title: 'Account created',
        description: 'Please check your email to verify your account.',
      });
      navigate('/verify-email');
    } catch {
      toast({
        title: 'Network error',
        description: 'Could not reach the server. Make sure the backend is running.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <Link to="/" className="inline-flex items-center gap-2 mb-8">
              <div className="h-10 w-10 rounded-xl bg-gradient-security flex items-center justify-center shadow-glow">
                <Shield className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-semibold text-xl text-foreground">anycircumstances</span>
            </Link>
            <h1 className="text-2xl font-bold text-foreground mb-2">Create your vault</h1>
            <p className="text-muted-foreground">Start protecting your important files today</p>
          </div>

          <section className="mb-6 rounded-xl border border-border bg-card/60 p-4" aria-labelledby="signup-overview-title">
            <h2 id="signup-overview-title" className="text-sm font-semibold text-foreground">How your protection works</h2>
            <div className="mt-3 space-y-3">
              <div className="flex gap-3">
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Your regular check-in PIN confirms you are safe and resets your check-in timer.
                </p>
              </div>
              <div className="flex gap-3">
                <Siren aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Your separate emergency PIN immediately starts sending assigned files to your verified emergency contacts when entered on the Check-in page.
                </p>
              </div>
              <div className="flex gap-3">
                <Clock3 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  If you miss a check-in, reminders and your grace period happen before automatic emergency delivery begins.
                </p>
              </div>
              <div className="flex gap-3">
                <KeyRound aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  You’ll set up three more things after this: a check-in PIN, an emergency PIN, and (when you upload your first file) a vault passphrase that encrypts your files. Your account password signs you in; it does not decrypt files.
                </p>
              </div>
            </div>
          </section>

          {plan && <PlanSummary plan={plan} editHref={pricingHrefForPlan(plan)} className="mb-6" />}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Your name</Label>
              <Input id="displayName" name="displayName" type="text" autoComplete="name"
                placeholder="How your trusted contacts know you" maxLength={120}
                value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                required disabled={loading} />
              <p className="text-xs text-muted-foreground">Your name identifies you in emergency emails to recipients.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a strong password"
                  value={password}
                  autoComplete="new-password"
                  aria-describedby="password-requirements"
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  disabled={loading}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
                </button>
              </div>

              <div id="password-requirements" className="grid grid-cols-2 gap-2 mt-3">
                {requirements.map((req) => (
                  <div
                    key={req.label}
                    className={`flex items-center gap-1.5 text-xs ${
                      req.check(password) ? 'text-success' : 'text-muted-foreground'
                    }`}
                  >
                    <Check className="h-3 w-3" />
                    {req.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                autoComplete="new-password"
                aria-invalid={Boolean(confirmPassword && !passwordsMatch)}
                aria-describedby={confirmPassword && !passwordsMatch ? "password-match-error" : undefined}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
              {confirmPassword && !passwordsMatch && (
                <p id="password-match-error" role="alert" className="text-xs text-destructive">Passwords do not match</p>
              )}
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                disabled={loading}
              />
              <label htmlFor="terms" className="text-sm text-muted-foreground leading-tight">
                I confirm that I am at least 13 years old and agree to the{' '}
                <Link to="/terms" className="text-primary hover:underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
              </label>
            </div>

            <Button type="submit" className="w-full min-h-11" disabled={loading} aria-describedby="signup-payment-note">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create account'}
            </Button>
            <p id="signup-payment-note" className="text-center text-xs leading-relaxed text-muted-foreground">
              {plan
                ? 'No payment is taken now. You’ll pay for this plan after account setup (email verification and your two PINs).'
                : 'No payment is taken now. You’ll choose a plan and pay after account setup (email verification and your two PINs).'}
            </p>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to={signInHref} className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 bg-gradient-hero items-center justify-center p-12">
        <div className="max-w-md text-center">
          <div className="h-20 w-20 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-8">
            <Shield className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-vault-foreground mb-4">
            Client-side file encryption
          </h2>
          <p className="text-vault-foreground/70">
            Files are encrypted in your browser before upload. Your vault key is backed up to your
            account, encrypted with a separate vault passphrase that you create when you upload your
            first file.
          </p>
        </div>
      </div>
    </div>
  );
}
