import { Link } from "react-router-dom";
import { AlertTriangle, Mail } from "lucide-react";

const walkthrough = [
  {
    title: "Open the link on the device where you want to keep the file",
    text: "Each link opens one file. A computer is easiest if you need to save or print documents.",
  },
  {
    title: "Select “Open shared file”",
    text: "The page explains what it is first, and the link isn’t used until you press the button. It works once, then stays open for 20 minutes in that browser.",
  },
  {
    title: "Select “Download decrypted file”",
    text: "The file is downloaded and decrypted in your browser, then saved to your device. You don’t need an account, password or special software.",
  },
  {
    title: "Repeat for each link in the email",
    text: "If several files were assigned to you, the email lists one link for each.",
  },
];

const limitations = [
  "Delivery is by email only. There are no text messages or phone calls.",
  "Each link can be opened once. After opening, it works for 20 minutes in that browser.",
  "Unopened links expire, after 30 days by default.",
  "Links can’t currently be re-sent, and AnyCircumstances can’t detect emails that bounce.",
  "Only contacts who confirmed their email address, and who have files assigned to them, receive anything.",
  "If the account owner deleted their account or cancelled their plan in the app, their files are deleted and links stop working.",
  "Recipients get their own copy of each file. They can save or share it, so choose people you trust.",
];

export function RecipientsPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-16 md:py-24">
      <header>
        <p className="micro-label"><span className="status-dot" aria-hidden="true" /> FOR RECIPIENTS</p>
        <h1 className="mt-6 text-4xl text-foreground md:text-6xl">What your recipients receive</h1>
        <p className="mt-6 max-w-3xl text-lg text-muted-foreground">
          If your files are released, each person you chose gets an email with secure links to the files you assigned to
          them. Here’s exactly what they’ll see, so you can tell them what to expect.
        </p>
      </header>

      <section aria-labelledby="confirm-title" className="mt-14">
        <h2 id="confirm-title" className="text-2xl font-semibold md:text-3xl">1. Confirming a contact, in advance</h2>
        <div className="mt-5 space-y-4 leading-7 text-muted-foreground">
          <p>
            When you add someone as an emergency contact, they receive an email titled “Confirm you’re an emergency contact”.
            It explains that they aren’t taking on any responsibility and don’t need an account. They click{" "}
            <strong className="text-foreground">Confirm emergency contact</strong>, and that’s it.
          </p>
          <p>
            The confirmation link is valid for 2 days. If it expires, you can resend it from{" "}
            <Link to="/app/emergency-contacts" className="text-primary underline underline-offset-4">Emergency contacts</Link>.
            Until a contact confirms, they can’t receive files.
          </p>
        </div>
      </section>

      <section aria-labelledby="release-title" className="mt-14">
        <h2 id="release-title" className="text-2xl font-semibold md:text-3xl">2. When a release happens</h2>
        <div className="mt-5 space-y-4 leading-7 text-muted-foreground">
          <p>A release starts in one of two ways:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>you missed a check-in and your grace period ran out, or</li>
            <li>you entered your emergency PIN, which starts delivery immediately.</li>
          </ul>
          <p>
            Shortly afterwards, each confirmed contact with at least one assigned file receives one email. The email doesn’t
            contain the files themselves or their names, only secure links.
          </p>
        </div>
      </section>

      <section aria-labelledby="sample-title" className="mt-14">
        <h2 id="sample-title" className="text-2xl font-semibold md:text-3xl">3. Sample delivery email</h2>
        <p className="mt-4 text-muted-foreground">
          This is a sample with fictional names. The wording matches the real email, which also shows the full address of
          each link; real emails contain working links.
        </p>
        <figure className="mt-6 overflow-hidden rounded-2xl border" aria-label="Sample emergency delivery email with fictional details">
          <div className="flex items-center gap-2 border-b bg-accent/40 px-5 py-3 text-sm font-medium text-foreground">
            <AlertTriangle aria-hidden="true" className="h-4 w-4" /> Sample only: fictional details
          </div>
          <div className="space-y-1 border-b px-5 py-4 text-sm text-muted-foreground">
            <p><span className="text-foreground">From:</span> AnyCircumstances</p>
            <p><span className="text-foreground">To:</span> Jordan Rivera &lt;jordan@example.com&gt;</p>
            <p><span className="text-foreground">Subject:</span> AnyCircumstances: Emergency access link</p>
          </div>
          <div className="space-y-4 px-5 py-6 text-[15px] leading-7 text-muted-foreground sm:px-8">
            <p className="text-2xl font-semibold text-foreground">Emergency access</p>
            <p>Hi Jordan,</p>
            <div>
              <p className="font-medium text-foreground">Why you received this</p>
              <p>The account owner missed a required check-in and their grace period has ended.</p>
            </div>
            <p><span className="font-medium text-foreground">Account:</span> alex@example.com</p>
            <div>
              <p className="font-medium text-foreground">Shared information</p>
              <p>Open each secure link to access the files assigned to you.</p>
              <ol className="mt-2 list-decimal space-y-2 pl-5">
                <li><span className="text-foreground underline underline-offset-4">Open shared file 1</span><br /><span className="break-all text-xs">https://anycircumstances.com/share#token=…</span></li>
                <li><span className="text-foreground underline underline-offset-4">Open shared file 2</span><br /><span className="break-all text-xs">https://anycircumstances.com/share#token=…</span></li>
              </ol>
            </div>
            <p><span className="inline-flex min-h-11 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground">Open shared information</span></p>
            <div className="rounded-xl border p-4 text-sm">
              <p className="font-medium text-foreground">Secure file access</p>
              <p>Open each link on the device where you want to save the file, then select Open shared file. Each link works once and expires if it is not used. You do not need an account.</p>
            </div>
            <p className="border-t pt-4 text-sm">These links provide access to private information. Keep them secure and do not forward this email. If this is unexpected, contact the account owner through a trusted channel.</p>
          </div>
        </figure>
        <p className="mt-3 text-sm text-muted-foreground">
          If you used your emergency PIN, the “Why you received this” line says the account owner triggered emergency access.
        </p>
      </section>

      <section aria-labelledby="walkthrough-title" className="mt-14">
        <h2 id="walkthrough-title" className="text-2xl font-semibold md:text-3xl">4. What the recipient does</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-2">
          {walkthrough.map((step, index) => (
            <li key={step.title} className="rounded-2xl border bg-card p-6">
              <span className="text-sm text-muted-foreground">Step {index + 1}</span>
              <h3 className="mt-2 text-lg font-semibold text-foreground">{step.title}</h3>
              <p className="mt-2 leading-7 text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="limitations" aria-labelledby="limitations-title" className="mt-14 scroll-mt-24 rounded-2xl border p-6 sm:p-8">
        <h2 id="limitations-title" className="text-2xl font-semibold md:text-3xl">Limitations to know about</h2>
        <ul className="mt-5 list-disc space-y-3 pl-5 leading-7 text-muted-foreground">
          {limitations.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>

      <section aria-labelledby="problems-title" className="mt-14">
        <h2 id="problems-title" className="text-2xl font-semibold md:text-3xl">If something changes or goes wrong</h2>
        <dl className="mt-6 divide-y rounded-2xl border">
          <div className="grid gap-2 p-5 md:grid-cols-[220px_1fr] md:gap-6">
            <dt className="font-semibold text-foreground">A contact’s email address changes</dt>
            <dd className="text-muted-foreground">Edit the contact and resend the confirmation email. They need to confirm the new address before they can receive files.</dd>
          </div>
          <div className="grid gap-2 p-5 md:grid-cols-[220px_1fr] md:gap-6">
            <dt className="font-semibold text-foreground">The email doesn’t arrive</dt>
            <dd className="text-muted-foreground">Check spam and junk folders for a message from AnyCircumstances. Because links can’t be re-sent, keep contact addresses current and tell your recipients to expect it.</dd>
          </div>
          <div className="grid gap-2 p-5 md:grid-cols-[220px_1fr] md:gap-6">
            <dt className="font-semibold text-foreground">A link says it was already opened</dt>
            <dd className="text-muted-foreground">Each link works once. If it was opened on another device, use that device within 20 minutes. Otherwise, contact the account owner or their family through a trusted channel.</dd>
          </div>
          <div className="grid gap-2 p-5 md:grid-cols-[220px_1fr] md:gap-6">
            <dt className="font-semibold text-foreground">You weren’t expecting the email</dt>
            <dd className="text-muted-foreground">Contact the account owner through a channel you already trust, such as a phone number you know, before acting on anything in the files.</dd>
          </div>
        </dl>
      </section>

      <aside className="mt-14 flex flex-col gap-4 rounded-2xl border bg-card p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="flex items-start gap-3">
          <Mail aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-primary" />
          <p className="text-muted-foreground">
            Want to know how files are protected in transit to recipients? Read{" "}
            <Link to="/security#recipients" className="text-primary underline underline-offset-4">how recipients open files</Link>.
          </p>
        </div>
        <Link to="/how-it-works" className="inline-flex min-h-11 items-center justify-center rounded-md border px-5 text-sm text-foreground hover:bg-accent">
          How check-ins work
        </Link>
      </aside>
    </div>
  );
}
