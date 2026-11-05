import { Link } from "react-router-dom";

const cookies = [
  { name: "access_token", purpose: "Keeps you signed in while you use the app.", duration: "15 minutes, renewed while you’re active" },
  { name: "refresh_token", purpose: "Keeps you signed in between visits until you sign out.", duration: "Up to 30 days" },
  { name: "vault_auth", purpose: "Set after you enter your check-in PIN to open your vault.", duration: "10 minutes" },
  { name: "share_session", purpose: "Set for an emergency recipient after they open a secure link, so they can download the file.", duration: "20 minutes" },
  { name: "uac_admin", purpose: "Used only by AnyCircumstances administrators signing in to the admin dashboard.", duration: "15 minutes" },
];

const storage = [
  { name: "Plan you selected", purpose: "Remembers the storage, check-in frequency and billing period you picked on the pricing page while you create your account.", where: "Local storage (key pendingCheckout), cleared once checkout starts or after 30 days" },
  { name: "Email being verified", purpose: "Remembers which address you’re verifying during sign-up.", where: "Session storage, cleared when you close the tab" },
  { name: "Quick guide language", purpose: "Remembers the language you chose for the in-app quick guide.", where: "Local storage" },
  { name: "Older vault keys", purpose: "Earlier versions of the app kept vault keys in the browser. The app still reads them if they exist, but no longer creates them.", where: "Local storage" },
];

export function CookiesPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-16 md:py-24">
      <p className="micro-label"><span className="status-dot" aria-hidden="true" /> COOKIES</p>
      <h1 className="mt-6 text-4xl md:text-6xl">Cookies and browser storage</h1>
      <p className="mt-6 max-w-3xl text-lg text-muted-foreground">
        AnyCircumstances uses only the cookies and browser storage it needs to work. There are no advertising, analytics or
        tracking cookies, so there are no optional cookies to switch on or off.
      </p>

      <section aria-labelledby="cookies-title" className="mt-12">
        <h2 id="cookies-title" className="text-2xl font-semibold">Cookies</h2>
        <p className="mt-3 text-muted-foreground">These are set by our server, can’t be read by page scripts, and are sent only over HTTPS.</p>
        <dl className="mt-6 divide-y rounded-2xl border">
          {cookies.map((c) => (
            <div key={c.name} className="grid gap-2 p-5 md:grid-cols-[200px_1fr] md:gap-6">
              <dt className="font-mono text-foreground">{c.name}</dt>
              <dd className="text-muted-foreground">{c.purpose} <span className="block pt-1 text-sm">How long: {c.duration}</span></dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="storage-title" className="mt-12">
        <h2 id="storage-title" className="text-2xl font-semibold">Browser storage</h2>
        <p className="mt-3 text-muted-foreground">This stays in your browser and isn’t sent to us automatically.</p>
        <dl className="mt-6 divide-y rounded-2xl border">
          {storage.map((s) => (
            <div key={s.name} className="grid gap-2 p-5 md:grid-cols-[200px_1fr] md:gap-6">
              <dt className="font-semibold text-foreground">{s.name}</dt>
              <dd className="text-muted-foreground">{s.purpose} <span className="block pt-1 text-sm">{s.where}</span></dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="third-title" className="mt-12 space-y-4 leading-7 text-muted-foreground">
        <h2 id="third-title" className="text-2xl font-semibold text-foreground">Third-party requests</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>The website’s font is loaded from Google Fonts, so your browser requests it from Google’s servers.</li>
          <li>The “Featured on Launch” badge in the footer is an image loaded from launchllama.co.</li>
          <li>When you pay on the web, you’re sent to Stripe Checkout, which uses its own cookies under Stripe’s policies.</li>
        </ul>
      </section>

      <section aria-labelledby="control-title" className="mt-12 space-y-4 leading-7 text-muted-foreground">
        <h2 id="control-title" className="text-2xl font-semibold text-foreground">Your choices</h2>
        <p>
          Signing out ends your session. You can also clear this site’s cookies and storage in your browser settings; you’ll be
          signed out, and you won’t be able to sign in or open your vault while cookies are blocked.
        </p>
        <p>
          More detail is in the <Link to="/privacy" className="text-primary underline underline-offset-4">Privacy Policy</Link>.
          Questions: <a className="text-primary underline underline-offset-4" href="mailto:contact@anycircumstances.com">contact@anycircumstances.com</a>.
        </p>
      </section>
    </div>
  );
}
