import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { KeyRound, Lock, Server, ShieldAlert, Eye, Trash2, Mail } from "lucide-react";

const stored = [
  { label: "Encrypted in your browser", items: ["The contents of every file you upload"] },
  {
    label: "Stored without encryption, because the service needs it to work",
    items: [
      "File names, file types and file sizes",
      "Your email address, plan and storage totals",
      "Your emergency contacts’ names, email addresses and relationship labels",
      "Your check-in schedule, reminders and check-in history",
      "The time, IP address and browser of any request that starts emergency delivery",
    ],
  },
  {
    label: "Stored only as one-way hashes",
    items: ["Your account password, check-in PIN and emergency PIN", "Emergency link tokens"],
  },
  { label: "Not stored by AnyCircumstances", items: ["Your vault passphrase", "Card numbers (web payments are handled by Stripe)"] },
];

const recovery = [
  {
    lost: "Account password",
    what: "Reset it from the sign-in page with a link sent to your email. Your files are not affected, and you still use your vault passphrase to open them yourself.",
  },
  {
    lost: "Vault passphrase",
    what: "We can’t reset or recover it, so you won’t be able to open your own files in the app. Your files stay stored, and emergency delivery to your assigned contacts still works because it uses the emergency-release key described above. Keep your passphrase somewhere safe outside your devices.",
  },
  {
    lost: "Check-in PIN or emergency PIN",
    what: "Reset both together in Check-in settings using your account password and a code sent to your email.",
  },
  {
    lost: "Your phone or computer",
    what: "Sign in on another device and unlock your vault with your vault passphrase. Your vault key is backed up to your account in encrypted form. If you last used your vault before key backup was added and never unlocked it since, its key may exist only in your old browser.",
  },
  {
    lost: "Access to your email account",
    what: "Your email is how password and PIN resets work, so someone who controls it may be able to take over your AnyCircumstances account. Protect your email with its own strong password and two-step verification. AnyCircumstances doesn’t offer two-factor authentication yet.",
  },
];

function Section({ id, icon: Icon, title, children }: { id: string; icon: typeof Lock; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 rounded-2xl border bg-card p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border sm:mt-1" aria-hidden="true">
          <Icon className="h-5 w-5 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`${id}-title`} className="text-2xl font-semibold text-foreground md:text-3xl">{title}</h2>
          <div className="mt-5 space-y-4 text-base leading-7 text-muted-foreground">{children}</div>
        </div>
      </div>
    </section>
  );
}

const SecurityPage = () => (
  <div className="container mx-auto max-w-4xl px-4 py-16 md:py-24">
    <header>
      <p className="micro-label"><span className="status-dot" aria-hidden="true" /> SECURITY</p>
      <h1 className="mt-6 text-4xl text-foreground md:text-6xl">How AnyCircumstances protects your files</h1>
      <p className="mt-6 max-w-3xl text-lg text-muted-foreground">
        This page explains what is encrypted, who holds which keys, what we can and can’t see, and what happens if you
        lose something. It describes how the service works today, including its limits.
      </p>
      <nav aria-label="On this page" className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <a className="text-primary underline underline-offset-4" href="#can-you-read">Can you read my files?</a>
        <a className="text-primary underline underline-offset-4" href="#encryption">Where encryption happens</a>
        <a className="text-primary underline underline-offset-4" href="#stored">What we store</a>
        <a className="text-primary underline underline-offset-4" href="#recipients">How recipients open files</a>
        <a className="text-primary underline underline-offset-4" href="#recovery">If you lose something</a>
        <a className="text-primary underline underline-offset-4" href="#limits">Known limitations</a>
      </nav>
    </header>

    <div className="mt-12 space-y-6">
      <Section id="can-you-read" icon={Eye} title="Can AnyCircumstances read my files?">
        <p className="text-lg text-foreground">
          Not as part of normal operation, but it is technically possible, and you should know why before you upload anything.
        </p>
        <p>
          Your files are encrypted in your browser before they’re uploaded, and your vault passphrase never leaves your
          device. But your emergency contacts need to be able to open your files without your passphrase. So each file’s key
          is also locked with an <strong className="text-foreground">emergency-release key</strong> that our servers can use
          through Amazon Web Services Key Management Service (AWS KMS).
        </p>
        <p>
          Our servers use that key when someone opens a valid emergency link. It also means AnyCircumstances is{" "}
          <strong className="text-foreground">not a “zero-knowledge” service</strong>. Someone with privileged access to our
          production systems could technically decrypt a file. The admin dashboard doesn’t show file names, file contents,
          contacts or keys, but you should treat AnyCircumstances as a service you trust, not one that is mathematically
          unable to read your files.
        </p>
      </Section>

      <Section id="encryption" icon={Lock} title="Where encryption happens">
        <ul className="list-disc space-y-3 pl-5">
          <li>
            <strong className="text-foreground">In your browser, before upload.</strong> Each file gets its own random 256-bit
            AES-GCM key and is encrypted in 4 MB pieces. Our storage receives only the encrypted data.
          </li>
          <li>
            <strong className="text-foreground">Each file key is locked twice.</strong> One copy is locked with your personal
            vault key, so you can open your files. The other is locked with the emergency-release key, so your recipients can
            open the files you assigned to them.
          </li>
          <li>
            <strong className="text-foreground">Your vault key is protected by your vault passphrase.</strong> The passphrase is
            separate from your account password and is turned into an encryption key in your browser (PBKDF2 with
            SHA-256: 600,000 iterations for new vaults, 200,000 for vaults created earlier). We store your vault key only in
            that encrypted form, which lets you unlock your vault on a new device.
          </li>
          <li>
            <strong className="text-foreground">In transit and in storage.</strong> Connections use HTTPS. Encrypted files are
            stored in Amazon S3, which adds its own server-side encryption on top.
          </li>
        </ul>
      </Section>

      <Section id="stored" icon={Server} title="What we store">
        <div className="grid gap-4 md:grid-cols-2">
          {stored.map((group) => (
            <div key={group.label} className="rounded-xl border p-5">
              <h3 className="text-base font-semibold text-foreground">{group.label}</h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6">
                {group.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          ))}
        </div>
        <p>
          Because file names aren’t encrypted, give sensitive files a neutral name, for example “Letter for Sam” rather than a
          name that reveals what’s inside.
        </p>
      </Section>

      <Section id="recipients" icon={Mail} title="How emergency recipients open files">
        <ol className="list-decimal space-y-3 pl-5">
          <li>Each verified contact receives an email with one secure link for each file you assigned to them.</li>
          <li>
            When they open a link, their browser creates a temporary key. Our server unlocks the file key with the
            emergency-release key and locks it again to that temporary key.
          </li>
          <li>The encrypted file is downloaded and decrypted in the recipient’s browser. They don’t need an account.</li>
        </ol>
        <p>
          Each link can be opened once, then works for 20 minutes in that browser. Unopened links expire, after 30 days by
          default.{" "}
          <Link to="/recipients" className="text-primary underline underline-offset-4">See what recipients receive</Link>.
        </p>
      </Section>

      <Section id="recovery" icon={KeyRound} title="If you lose something">
        <p>
          There are two kinds of recovery. <strong className="text-foreground">Getting back into your account</strong>{" "}
          (password and PINs) works through your email. <strong className="text-foreground">Being able to decrypt your own
          files</strong> depends on your vault passphrase, which only you have.
        </p>
        <dl className="divide-y rounded-xl border">
          {recovery.map((row) => (
            <div key={row.lost} className="grid gap-2 p-5 md:grid-cols-[200px_1fr] md:gap-6">
              <dt className="font-semibold text-foreground">{row.lost}</dt>
              <dd>{row.what}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="limits" icon={ShieldAlert} title="Known limitations">
        <ul className="list-disc space-y-3 pl-5">
          <li>Not zero-knowledge: the emergency-release key lets our systems decrypt files when an emergency link is opened.</li>
          <li>File names, types and sizes, and your contacts’ details, are not encrypted.</li>
          <li>There’s no two-factor authentication yet. Your email account protects password and PIN resets.</li>
          <li>
            A vault passphrase needs only 8 characters, but a long, unique passphrase is much harder to guess. It protects the
            encrypted copy of your vault key that we store.
          </li>
          <li>Emergency links work once and expire. Recipients should open them on the device where they want to save the file.</li>
        </ul>
      </Section>

      <Section id="infrastructure" icon={Trash2} title="Infrastructure, payments and deletion">
        <ul className="list-disc space-y-3 pl-5">
          <li>The service runs on Amazon Web Services: servers, file storage (S3) and key management (KMS).</li>
          <li>Web payments are processed by Stripe. If you subscribe through the iOS app, Apple processes the payment.</li>
          <li>We don’t sell your data. See the <Link to="/privacy" className="text-primary underline underline-offset-4">Privacy Policy</Link>.</li>
          <li>
            Deleting a file removes it from storage. Deleting your account removes your files, contacts, check-in history and
            pending emergency links, and links already sent stop working. Cancelling your plan in the app also permanently
            deletes your stored files.
          </li>
        </ul>
      </Section>
    </div>

    <aside className="mt-10 rounded-2xl border p-6 sm:p-8">
      <h2 className="text-xl font-semibold text-foreground">Questions or a security concern?</h2>
      <p className="mt-3 text-muted-foreground">
        Email <a className="text-primary underline underline-offset-4" href="mailto:contact@anycircumstances.com">contact@anycircumstances.com</a>.
        Related: <Link to="/faq" className="text-primary underline underline-offset-4">FAQ</Link>,{" "}
        <Link to="/how-it-works" className="text-primary underline underline-offset-4">how check-ins work</Link>,{" "}
        <Link to="/recipients" className="text-primary underline underline-offset-4">what recipients receive</Link>.
      </p>
    </aside>
  </div>
);

export default SecurityPage;
