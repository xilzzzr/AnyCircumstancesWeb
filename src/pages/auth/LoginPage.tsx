import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { refreshSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const signOutReason = location.state?.signOutReason;
  const signOutNotice = signOutReason === 'incorrect-check-in-pin'
    ? 'The PIN you entered is incorrect. You’ve been logged out. Please sign in again to retry your check-in.'
    : signOutReason === 'session-expired'
      ? 'Your session has expired. You’ve been logged out. Please sign in again.'
      : null;
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const resp = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      let data: any = null;
      try {
        data = await resp.json();
      } catch {
        data = null;
      }

      if (!resp.ok || !data?.ok) {
        const code = data?.error || 'login_failed';

        if (resp.status === 429) {
          const seconds = Number(resp.headers.get('Retry-After'));
          const wait = Number.isFinite(seconds) && seconds > 0
            ? `Try again in ${Math.ceil(seconds / 60)} minute(s).`
            : 'Please wait a few minutes and try again.';
          toast({ title: 'Too many login attempts', description: wait });
          return;
        }

        if (code === 'email_not_verified') {
          toast({
            title: 'Verify your email',
            description: 'Please verify your email before logging in.',
          });
          return;
        }

        if (code === 'invalid_credentials') {
          toast({
            title: 'Incorrect email or password',
            description: 'Double-check your credentials and try again.',
          });
          return;
        }

        if (code === 'account_disabled') {
          toast({
            title: 'Account disabled',
            description: 'This account is currently disabled.',
          });
          return;
        }

        toast({
          title: 'Login failed',
          description: 'Please try again.',
        });
        return;
      }

      if (!await refreshSession()) {
        toast({ title: 'Could not load your session', description: 'Please try signing in again.' });
        return;
      }
      toast({
        title: 'Welcome back',
        description: 'You have successfully logged in.',
      });
      navigate('/app');
    } catch {
      toast({
        title: 'Network error',
        description: 'Could not reach the server. Make sure the backend is running.',
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
            <h1 className="text-2xl font-bold text-foreground mb-2">Welcome back</h1>
            <p className="text-muted-foreground">Enter your credentials to access your vault</p>
          </div>

          {signOutNotice && !noticeDismissed && (
            <div role="alert" className="mb-6 rounded-lg border border-warning/50 bg-warning/10 p-4 text-foreground">
              <p className="text-sm">{signOutNotice}</p>
              <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setNoticeDismissed(true)}>
                Dismiss
              </Button>
            </div>
          )}

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
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  autoComplete="current-password"
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
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link to="/signup" className="text-primary font-medium hover:underline">
              Sign up
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
            Your data is always encrypted
          </h2>
          <p className="text-vault-foreground/70">
            Files are encrypted on your device before upload. The service stores ciphertext and
            protected recovery-key material for emergency delivery.
          </p>
        </div>
      </div>
    </div>
  );
}
