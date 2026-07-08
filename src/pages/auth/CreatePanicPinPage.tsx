import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Loader2, KeyRound, ArrowLeft, Siren } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

export function CreatePanicPinPage() {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [loading, setLoading] = useState(false);

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
        body: JSON.stringify({ pin }),
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
              ? 'This PIN triggers emergency dispatch. Choose 4 to 6 digits. Keep it secret.'
              : 'Enter your emergency PIN again to confirm.'}
          </p>
        </div>

        <div className="space-y-6">
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
            <Button className="w-full" disabled={confirmPin.length < 4 || loading} onClick={handleSubmit}>
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

          <p className="text-xs text-center text-muted-foreground">
            Your emergency PIN is stored securely. Entering it will dispatch your emergency contacts.
          </p>
        </div>
      </div>
    </div>
  );
}
