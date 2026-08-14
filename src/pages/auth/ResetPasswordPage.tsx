import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Loader2, ArrowLeft, Lock, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const requirements = [
  { label: 'At least 10 characters', check: (p: string) => p.length >= 10 },
  { label: 'One uppercase letter', check: (p: string) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', check: (p: string) => /[a-z]/.test(p) },
  { label: 'One number', check: (p: string) => /\d/.test(p) },
];

export function ResetPasswordPage() {
  const [token] = useState(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const value = String(hash.get('token') || '');
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    return value;
  });

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();

  const passwordValid = requirements.every(r => r.check(password));
  const passwordsMatch = password === confirmPassword && password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast({
        title: 'Invalid link',
        description: 'This reset link is missing a token.',
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

    setLoading(true);
    try {
      const resp = await fetch('/auth/password-reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, password }),
      });

      let data: any = null;
      try {
        data = await resp.json();
      } catch {
        data = null;
      }

      if (!resp.ok || !data?.ok) {
        const code = data?.error || 'reset_failed';

        if (code === 'invalid_token' || code === 'expired') {
          toast({
            title: 'Reset link expired',
            description: 'Request a new password reset link and try again.',
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
          title: 'Reset failed',
          description: 'Please try again.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Password updated',
        description: 'You can now log in with your new password.',
      });
      navigate('/login');
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
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="w-full max-w-md">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </Link>

        <div className="text-center mb-8">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Set a new password</h1>
          <p className="text-muted-foreground">
            Choose a strong password you’ll remember.
          </p>
        </div>

        {!token ? (
          <div className="rounded-lg border p-4 text-sm text-muted-foreground">
            This link is missing a token. Go back and request a new reset link.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Create a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />

              <div className="grid grid-cols-2 gap-2 mt-3">
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
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
              {confirmPassword && !passwordsMatch && (
                <p className="text-xs text-destructive">Passwords do not match</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update password'}
            </Button>
          </form>
        )}

        <div className="mt-10 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Shield className="h-4 w-4" />
          Password reset links expire for safety.
        </div>
      </div>
    </div>
  );
}
