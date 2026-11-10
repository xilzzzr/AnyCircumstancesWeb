import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock3, CircleAlert, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Verifying by link does not sign the user in, so the next step is signing in and
// then continuing PIN setup (LoginPage honours this internal "next" path).
const FINISH_SETUP_HREF = `/login?next=${encodeURIComponent('/create-pin')}`;

const states = {
  success: { heading: 'Email verified', body: 'Your email address has been successfully verified. Next, sign in to create your check-in PIN and emergency PIN.', Icon: CheckCircle2 },
  already_verified: { heading: 'Email already verified', body: 'This email address has already been verified. You can sign in to your account.', Icon: CheckCircle2 },
  expired: { heading: 'This verification link has expired', body: 'For security, verification links are only valid for a limited time. Request a new verification email to continue.', Icon: Clock3 },
  invalid: { heading: "We couldn't verify this email", body: 'This verification link is invalid or may have already been used. Try signing in or request another verification email.', Icon: CircleAlert },
  error: { heading: 'Something went wrong', body: "We couldn't verify your email right now. Please try again.", Icon: CircleAlert },
};

export function EmailVerifiedPage() {
  const [params] = useSearchParams();
  const requested = params.get('status') || 'invalid';
  const status = Object.prototype.hasOwnProperty.call(states, requested) ? requested as keyof typeof states : 'invalid';
  const { heading, body, Icon } = states[status];
  const verified = status === 'success' || status === 'already_verified';
  const primary = status === 'expired'
    ? { href: '/verify-email?resend=1', label: 'Send a new verification email' }
    : status === 'success'
      ? { href: FINISH_SETUP_HREF, label: 'Sign in to finish setup' }
      : { href: '/login', label: 'Sign in' };

  return (
    <main id="main-content" className="min-h-screen bg-background flex items-center justify-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-lg">
        <Link to="/" className="mx-auto mb-8 flex w-fit items-center gap-3 text-foreground font-semibold">
          <span className="public-logo flex h-10 w-10 items-center justify-center rounded-xl"><Shield aria-hidden="true" className="h-5 w-5" /></span>
          AnyCircumstances
        </Link>
        <section aria-labelledby="verification-heading" className="editorial-card p-6 sm:p-10 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
            <Icon aria-hidden="true" className="h-8 w-8 text-primary" />
          </div>
          <h1 id="verification-heading" className="text-3xl font-medium tracking-tight text-foreground leading-tight">{heading}</h1>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">{body}</p>
          <div className="mt-8 flex flex-col gap-3">
            <Button asChild className="w-full min-h-12"><Link to={primary.href}>{primary.label}</Link></Button>
            {!verified && <Button asChild variant="outline" className="w-full min-h-12"><Link to={status === 'expired' ? '/login' : '/verify-email?resend=1'}>{status === 'expired' ? 'Sign in' : 'Request new verification email'}</Link></Button>}
          </div>
          {status === 'success' && <p className="mt-6 text-sm leading-relaxed text-muted-foreground">After you sign in you’ll create your check-in PIN and a separate emergency PIN, then choose a plan.</p>}
          {status === 'already_verified' && (
            <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
              Haven’t created your check-in PIN and emergency PIN yet?{' '}
              <Link to={FINISH_SETUP_HREF} className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">Sign in to finish setup</Link>
            </p>
          )}
          {status === 'error' && <p className="mt-6 text-sm text-muted-foreground">Try opening the link in your email again, or request a new verification email.</p>}
        </section>
        <p className="mt-8 text-center text-sm text-muted-foreground">Your information, delivered when it matters.</p>
      </div>
    </main>
  );
}
