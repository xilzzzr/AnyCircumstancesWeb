import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Siren, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function CreatePanicPinPage() {
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
        description: 'Your emergency PIN must be 4 to 6 digits.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch('/auth/set-panic-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pin, password }),
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok || !data?.ok) {
        const code = data?.error || 'panic_pin_failed';

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
            description: 'Your emergency PIN must be 4 to 6 digits.',
            variant: 'destructive',
          });
          return;
        }
        if (code === 'reauthentication_failed') {
          toast({ title: 'Password required', description: 'Enter your current account password.', variant: 'destructive' });
          return;
        }
        if (code === 'emergency_pin_conflicts_with_pin') {
          toast({ title: 'Choose a different PIN', description: 'Your emergency PIN must be different from your check-in PIN.', variant: 'destructive' });
          setStep('create');
          setPin('');
          setConfirmPin('');
          return;
        }
        if (code === 'use_pin_reset_flow') {
          toast({ title: 'Emergency PIN already set', description: 'Your emergency PIN was created earlier.' });
          navigate('/onboarding');
          return;
        }

        toast({
          title: 'Could not save emergency PIN',
          description: 'Please try again.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Emergency PIN created',
        description: 'Your emergency PIN has been set.',
      });

      navigate('/onboarding');
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
          to="/create-pin"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <div className="text-center mb-8">
          <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <Siren className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {step === 'create' ? 'Create your emergency PIN' : 'Confirm your emergency PIN'}
          </h1>
          <p className="text-muted-foreground">
            {step === 'create'
              ? 'This is not a backup check-in PIN. Choose 4 to 6 digits that are different from your check-in PIN, and keep it secret.'
              : 'Enter your emergency PIN again to confirm.'}
          </p>
        </div>

        <div className="space-y-6">
          <section aria-labelledby="emergency-pin-warning" className="rounded-xl border-2 border-destructive/60 bg-destructive/10 p-4 text-left">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle aria-hidden="true" className="h-5 w-5 shrink-0" />
              <h2 id="emergency-pin-warning" className="text-base font-semibold">Warning: this PIN sends your files immediately</h2>
            </div>
            <p className="mt-3 text-sm font-medium leading-relaxed text-foreground">
              If you enter your emergency PIN where you would normally enter your check-in PIN, your verified emergency contacts are immediately emailed links to the files assigned to them.
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-foreground">
              <li>There is no delay and no grace period, and it cannot be undone.</li>
              <li>On screen it looks like a normal check-in, so someone watching can’t tell (duress protection).</li>
              <li>Entering it in the cancel-plan or delete-account confirmation also sends your files, and locks your account for 24 hours instead of cancelling or deleting.</li>
              <li>It must be different from your check-in PIN.</li>
            </ul>
          </section>

          <div className="space-y-2">
            <Label htmlFor="panic-current-password">Current account password</Label>
            <Input id="panic-current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" disabled={loading} />
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
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Set emergency PIN'}
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

          <p className="text-sm text-center text-muted-foreground">
            Use your regular check-in PIN whenever you are safe. Use the emergency PIN only when you want your contacts to receive their files now.
          </p>
        </div>
      </div>
    </div>
  );
}
