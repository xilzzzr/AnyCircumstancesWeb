import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Clock, Bell, Shield, Loader2, Save, AlertTriangle } from 'lucide-react';

type Frequency = 'daily' | 'weekly' | 'monthly';

export function VerificationSettingsPage() {
  const [frequency, setFrequency] = useState<Frequency>('weekly');
  const [gracePeriod, setGracePeriod] = useState(24);
  const [reminders, setReminders] = useState('3');
  const [saving, setSaving] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const resp = await fetch('/auth/verification-settings', {
          method: 'GET',
          credentials: 'include',
        });

        const data = await resp.json().catch(() => null);

        if (!resp.ok || !data?.ok) {
          if (!cancelled) {
            toast({
              title: 'Could not load settings',
              description: 'Please log in again and retry.',
              variant: 'destructive',
            });
          }
          return;
        }

        const s = data.settings;
        if (!cancelled && s) {
          setFrequency(s.frequency);
          setGracePeriod(Number(s.gracePeriodHours ?? 24));
          setReminders(String(s.reminders ?? 3));
        }
      } catch {
        if (!cancelled) {
          toast({
            title: 'Network error',
            description: 'Could not reach the server.',
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) setLoadingInitial(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [toast]);

  const handleSave = async () => {
    setSaving(true);

    try {
      const resp = await fetch('/auth/verification-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          frequency,
          gracePeriodHours: gracePeriod,
          reminders: Number(reminders),
        }),
      });

      const data = await resp.json().catch(() => null);

      if (!resp.ok || !data?.ok) {
        const code = data?.error || 'save_failed';

        if (code === 'not_authenticated') {
          toast({
            title: 'Session expired',
            description: 'Please log in again.',
            variant: 'destructive',
          });
          return;
        }

        toast({
          title: 'Save failed',
          description: 'Please try again.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Settings saved',
        description: 'Your verification settings have been updated.',
      });
    } catch {
      toast({
        title: 'Network error',
        description: 'Could not reach the server.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const getFrequencyDescription = () => {
    switch (frequency) {
      case 'daily':
        return 'You will need to check in every 24 hours.';
      case 'weekly':
        return 'You will need to check in once every 7 days.';
      case 'monthly':
        return 'You will need to check in once every 30 days.';
    }
  };

  const getGracePeriodLabel = () => {
    if (gracePeriod < 24) return `${gracePeriod} hours`;
    if (gracePeriod === 24) return '1 day';
    if (gracePeriod === 48) return '2 days';
    if (gracePeriod === 72) return '3 days';
    return `${gracePeriod} hours`;
  };

  if (loadingInitial) {
    return (
      <div className="p-6 lg:p-8 space-y-6 max-w-3xl">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading settings...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 pb-24 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Verification Settings</h1>
        <p className="text-muted-foreground">Configure how and when you verify your status</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-primary" />
            Check-in Frequency
          </CardTitle>
          <CardDescription>How often do you want to confirm you're okay?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
            <div className="grid gap-3">
              <Label
                htmlFor="daily"
                className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                  frequency === 'daily' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                }`}
              >
                <RadioGroupItem value="daily" id="daily" />
                <div className="flex-1">
                  <p className="font-medium">Daily</p>
                  <p className="text-sm text-muted-foreground">Check in every 24 hours</p>
                </div>
              </Label>

              <Label
                htmlFor="weekly"
                className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                  frequency === 'weekly' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                }`}
              >
                <RadioGroupItem value="weekly" id="weekly" />
                <div className="flex-1">
                  <p className="font-medium">Weekly</p>
                  <p className="text-sm text-muted-foreground">Check in once a week</p>
                </div>
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">Recommended</span>
              </Label>

              <Label
                htmlFor="monthly"
                className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                  frequency === 'monthly' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                }`}
              >
                <RadioGroupItem value="monthly" id="monthly" />
                <div className="flex-1">
                  <p className="font-medium">Monthly</p>
                  <p className="text-sm text-muted-foreground">Check in once a month</p>
                </div>
              </Label>
            </div>
          </RadioGroup>

          <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">{getFrequencyDescription()}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-primary" />
            Grace Period
          </CardTitle>
          <CardDescription>How long after a missed check-in before your files are delivered?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Grace period duration</span>
              <span className="font-medium text-primary">{getGracePeriodLabel()}</span>
            </div>
            <Slider
              value={[gracePeriod]}
              onValueChange={(v) => setGracePeriod(v[0])}
              min={6}
              max={72}
              step={6}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>6 hours</span>
              <span>72 hours</span>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground">Important</p>
              <p className="text-muted-foreground">
                After the grace period expires, your selected files will be automatically sent to your emergency contacts.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5 text-primary" />
            Reminder Notifications
          </CardTitle>
          <CardDescription>How many reminders should we send before delivering your files?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={reminders} onValueChange={setReminders}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 reminder</SelectItem>
              <SelectItem value="2">2 reminders</SelectItem>
              <SelectItem value="3">3 reminders (Recommended)</SelectItem>
              <SelectItem value="4">4 reminders</SelectItem>
              <SelectItem value="5">5 reminders</SelectItem>
            </SelectContent>
          </Select>

          <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            We'll send {reminders} reminder{parseInt(reminders) > 1 ? 's' : ''} via email and push notification during
            your grace period before any files are delivered.
          </p>
        </CardContent>
      </Card>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground">Your current settings</p>
              <p className="text-muted-foreground mt-1">
                You will check in <span className="font-medium text-foreground">{frequency}</span>. If you miss a check-in,
                you'll receive <span className="font-medium text-foreground">{reminders} reminder{parseInt(reminders) > 1 ? 's' : ''}</span>{' '}
                over a <span className="font-medium text-foreground">{getGracePeriodLabel()}</span> grace period before your
                files are sent to your emergency contacts.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-t z-40 lg:left-64">
        <div className="max-w-3xl mx-auto flex justify-center">
          <Button onClick={handleSave} disabled={saving} className="gap-2 shadow-lg">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save settings
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}