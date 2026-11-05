import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Loader2, KeyRound, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function CreatePinPage() {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');

  const navigate = useNavigate();
  const { toast } = useToast();

  const handlePinChange = (value: string) => {
    if (step === 'create') setPin(value);
    else setConfirmPin(value);
  };

  const handleContinue = () => {
    if (step === 'create' && pin.length >= 4) setStep('confirm');
  };

  const handleSubmit = async () => {
    if (pin !== confirmPin) {
      toast({
        title: 'PINs do not match',
        description: 'Please try again.',
        variant: 'destructive',
      });
      setConfirmPin('');
      return;
    }

    if (!/^\d{4,6}$/.test(pin)) {
      toast({
        title: 'Invalid PIN',
        description: 'Your PIN must be 4 to 6 digits.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch('/auth/set-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pin, password }),
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok || !data?.ok) {
        const code = data?.error || 'pin_failed';

        if (code === 'not_authenticated' || code === 'invalid_session') {
          toast({
            title: 'Session expired',
            description: 'Please log in again.',
            variant: 'destructive',
          });
          navigate('/login');
          return;
        }

        if (code === 'invalid_pin') {
          toast({
            title: 'Invalid PIN',
            description: 'Your PIN must be 4 to 6 digits.',
            variant: 'destructive',
          });
          return;
        }
        if (code === 'reauthentication_failed') {
          toast({ title: 'Password required', description: 'Enter your current account password.', variant: 'destructive' });
          return;
        }
        if (code === 'pin_conflicts_with_emergency_pin') {
          toast({ title: 'Choose a different PIN', description: 'Your check-in PIN must be different from your emergency PIN.', variant: 'destructive' });
          setStep('create');
          setPin('');
          setConfirmPin('');
          return;
        }
        if (code === 'use_pin_reset_flow') {
          toast({ title: 'Check-in PIN already set', description: 'Your check-in PIN was created earlier. Continue with your emergency PIN.' });
          navigate('/create-panic-pin');
          return;
        }

        toast({
          title: 'Could not save PIN',
          description: 'Please try again.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'PIN created',
        description: 'Your verification PIN has been set.',
      });
      navigate('/create-panic-pin');
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

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="w-full max-w-md">
        <Link
          to="/verify-email"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <div className="text-center mb-8">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <KeyRound className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {step === 'create' ? 'Create your PIN' : 'Confirm your PIN'}
          </h1>
          <p className="text-muted-foreground">
            {step === 'create'
              ? 'This is your check-in PIN. Choose 4 to 6 digits.'
              : 'Enter your PIN again to confirm.'}
          </p>
        </div>

        <div className="space-y-6">
          <section aria-labelledby="checkin-pin-about" className="rounded-xl border border-border bg-card/60 p-4 text-left">
            <h2 id="checkin-pin-about" className="text-sm font-semibold text-foreground">What the check-in PIN does</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
              <li>You enter it to check in and confirm you’re safe, which resets your check-in timer.</li>
              <li>It also confirms sensitive actions, such as unlocking your vault or cancelling your plan.</li>
              <li>Resetting it later needs your account password and a code we email you.</li>
            </ul>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Next you’ll create a separate emergency PIN. The two PINs must be different.
            </p>
          </section>
          <div className="space-y-2">
            <Label htmlFor="pin-current-password">Current account password</Label>
            <Input id="pin-current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" disabled={loading} aria-describedby="pin-password-help" />
            <p id="pin-password-help" className="text-xs text-muted-foreground">Confirms it’s you. Your password signs you in; it doesn’t decrypt files.</p>
          </div>
          <div className="flex justify-center">
            {step === 'create' ? (
              <InputOTP maxLength={6} value={pin} onChange={handlePinChange}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            ) : (
              <InputOTP maxLength={6} value={confirmPin} onChange={handlePinChange}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            )}
          </div>

          {step === 'create' && (
            <Button className="w-full" disabled={pin.length < 4} onClick={handleContinue}>
              Continue
            </Button>
          )}

          {step === 'confirm' && (
            <Button className="w-full" disabled={confirmPin.length < 4 || !password || loading} onClick={handleSubmit}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Set PIN'}
            </Button>
          )}

          {step === 'confirm' && (
            <Button
              variant="ghost"
              className="w-full"
              disabled={loading}
              onClick={() => {
                setStep('create');
                setPin('');
                setConfirmPin('');
              }}
            >
              Start over
            </Button>
          )}

          <p className="text-xs text-center text-muted-foreground">
            We store only a hashed version of your PIN, never the PIN itself.
          </p>
        </div>
      </div>
    </div>
  );
}
