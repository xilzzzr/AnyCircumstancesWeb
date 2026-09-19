import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Shield, Eye, EyeOff, Loader2, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const requirements = [
  { label: 'At least 10 characters', check: (p: string) => p.length >= 10 },
  { label: 'One uppercase letter', check: (p: string) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', check: (p: string) => /[a-z]/.test(p) },
  { label: 'One number', check: (p: string) => /\d/.test(p) },
];

export function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const passwordValid = requirements.every(r => r.check(password));
  const passwordsMatch = password === confirmPassword && password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
        body: JSON.stringify({ email, password, ageConfirmed: true }),
      });

      let data: any = null;
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

          <form onSubmit={handleSubmit} className="space-y-4">
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

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create account'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 bg-gradient-hero items-center justify-center p-12">
        <div className="max-w-md text-center">
          <div className="h-20 w-20 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-8 animate-pulse-glow">
            <Shield className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-vault-foreground mb-4">
            Client-side file encryption
          </h2>
          <p className="text-vault-foreground/70">
            Files are encrypted on your device before upload. Your separate vault passphrase
            protects the private key stored on that device.
          </p>
        </div>
      </div>
    </div>
  );
}
