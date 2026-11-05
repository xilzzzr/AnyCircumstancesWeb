import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Mail, ArrowLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useAuth } from '@/contexts/AuthContext';

export function VerifyEmailPage() {
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();
  const { refreshSession } = useAuth();

  useEffect(() => {
    const saved = sessionStorage.getItem('pending_verify_email') || '';
    setEmail(saved);
  }, []);

  const handleVerify = async () => {
    if (code.length !== 6) return;

    if (!email) {
      toast({
        title: 'Missing email',
        description: 'Enter your account email address below.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/auth/verify-email-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, code }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        const msg =
          data?.error === 'invalid_code' ? 'That code is incorrect.' :
          data?.error === 'expired' ? 'That code expired. Resend a new one.' :
          'Verification failed. Try again.';
        toast({ title: 'Verification failed', description: msg, variant: 'destructive' });
        setLoading(false);
        return;
      }

      sessionStorage.removeItem('pending_verify_email');

      if (!await refreshSession()) {
        toast({
          title: 'Email verified. Please sign in.',
          description: 'We could not load your session. Sign in to continue setting up your PIN.',
          variant: 'destructive',
        });
        navigate('/login');
        return;
      }

      toast({
        title: 'Email verified',
        description: 'Your account has been verified. Please set up your PIN.',
      });

      navigate('/create-pin');
    } catch {
      toast({
        title: 'Network error',
        description: 'Could not reach the server.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      toast({
        title: 'Missing email',
        description: 'Enter your account email address below.',
        variant: 'destructive',
      });
      return;
    }

    setResending(true);
    try {
      const res = await fetch('/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        toast({
          title: 'Resend failed',
          description: 'Try again in a moment.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Check your inbox',
        description: 'If this address belongs to an account awaiting verification, a new email will arrive shortly.',
      });
    } catch {
      toast({
        title: 'Network error',
        description: 'Could not reach the server.',
        variant: 'destructive',
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="w-full max-w-md">
        <Link
          to="/signup"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign up
        </Link>

        <div className="text-center mb-8">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Verify your email</h1>
          <p className="text-muted-foreground">
            Enter your account email and the 6-digit code from your verification email. You can also request a new email below.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Next you’ll create your check-in PIN and emergency PIN. If you use the link in the email instead, sign in afterwards to finish setup.
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="verification-email">Account email address</Label>
            <Input id="verification-email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={(event) => { setEmail(event.target.value); setCode(''); }} />
          </div>
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={code} onChange={setCode}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button className="w-full" disabled={code.length !== 6 || loading} onClick={handleVerify}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify email'}
          </Button>

          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">Didn&apos;t receive the code?</p>
            <Button variant="ghost" size="sm" disabled={resending || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())} onClick={handleResend}>
              {resending ? 'Sending...' : 'Send a new verification email'}
            </Button>
          </div>

          <div className="text-center pt-4 border-t border-border">
            <Link to="/login" className="text-sm text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
