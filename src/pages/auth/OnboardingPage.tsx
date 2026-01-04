import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  Clock, 
  CreditCard, 
  Upload, 
  Check, 
  ArrowRight,
  Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const steps = [
  {
    id: 'contacts',
    title: 'Emergency Contacts',
    description: 'Add trusted people who will receive your files',
    icon: Users,
    href: '/app/emergency-contacts',
  },
  {
    id: 'verification',
    title: 'Verification Schedule',
    description: 'Set how often you want to check in',
    icon: Clock,
    href: '/app/verification',
  },
  {
    id: 'billing',
    title: 'Payment Method',
    description: 'Add a payment method for your subscription',
    icon: CreditCard,
    href: '/app/billing/payment',
  },
  {
    id: 'upload',
    title: 'Upload First File',
    description: 'Start protecting your important files',
    icon: Upload,
    href: '/app/upload',
  },
];

export function OnboardingPage() {
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const navigate = useNavigate();
  const { setRole } = useAuth();

  const progress = (completedSteps.length / steps.length) * 100;

  const handleStepClick = (stepId: string, href: string) => {
    // Mark as completed for demo purposes
    if (!completedSteps.includes(stepId)) {
      setCompletedSteps([...completedSteps, stepId]);
    }
    navigate(href);
  };

  const handleSkip = () => {
    setRole('user');
    navigate('/app');
  };

  const handleComplete = () => {
    setRole('user');
    navigate('/app');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="h-10 w-10 rounded-xl bg-gradient-security flex items-center justify-center shadow-glow">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-xl text-foreground">UnderAnyCircumstance</span>
          </Link>
          <h1 className="text-2xl font-bold text-foreground mb-2">Complete your setup</h1>
          <p className="text-muted-foreground">
            Just a few more steps to get your vault fully configured.
          </p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Setup progress</span>
            <span className="font-medium">{completedSteps.length} of {steps.length} completed</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Steps */}
        <div className="space-y-3 mb-8">
          {steps.map((step) => {
            const isCompleted = completedSteps.includes(step.id);
            
            return (
              <button
                key={step.id}
                onClick={() => handleStepClick(step.id, step.href)}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left",
                  isCompleted 
                    ? "bg-success/5 border-success/30" 
                    : "bg-card border-border hover:border-primary/30 hover:shadow-md"
                )}
              >
                <div className={cn(
                  "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                  isCompleted ? "bg-success/10" : "bg-primary/10"
                )}>
                  {isCompleted ? (
                    <Check className="h-5 w-5 text-success" />
                  ) : (
                    <step.icon className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground">{step.title}</div>
                  <div className="text-sm text-muted-foreground">{step.description}</div>
                </div>
                <ArrowRight className={cn(
                  "h-5 w-5 shrink-0",
                  isCompleted ? "text-success" : "text-muted-foreground"
                )} />
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={handleSkip}
          >
            Skip for now
          </Button>
          <Button 
            className="flex-1"
            onClick={handleComplete}
            disabled={completedSteps.length === 0}
          >
            Go to dashboard
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground mt-6">
          You can always complete these steps later from your dashboard.
        </p>
      </div>
    </div>
  );
}
