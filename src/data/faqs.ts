export type FaqLink = { label: string; to: string };
export type FaqItem = { question: string; answer: string; links?: FaqLink[] };
export type FaqGroup = { id: string; title: string; items: FaqItem[] };

export const faqGroups: FaqGroup[] = [
  {
    id: "basics",
    title: "Getting started",
    items: [
      {
        question: "What does AnyCircumstances do?",
        answer:
          "It stores important files in an encrypted vault and lets you choose who should receive each file. You check in on a schedule. If you stop checking in and your grace period runs out, the people you chose are emailed secure links to the files you assigned to them.",
        links: [{ label: "How it works", to: "/how-it-works" }],
      },
      {
        question: "Is there a free plan or free trial?",
        answer:
          "There’s no free plan. A 30-day free trial is available only with a single-use Pioneer invitation code; a card is required, and after the trial the plan renews at 20% off unless you cancel. Without a code, you need a paid plan before you can store files or add emergency contacts. Plans start at $4.99 a month for 5 GB with monthly check-ins.",
        links: [{ label: "Build a plan", to: "/pricing" }],
      },
      {
        question: "How much does it cost?",
        answer:
          "The price depends on how much storage you choose (5 to 200 GB) and how often you check in. Monthly check-ins are included, weekly check-ins add $1.99 a month and daily / scheduled check-ins add $2.99 a month. Annual billing costs 10 times the monthly price and is charged once a year. Prices are in US dollars.",
        links: [{ label: "See pricing", to: "/pricing" }],
      },
      {
        question: "Is this only for end-of-life planning?",
        answer:
          "No. People also use it for travel, hospital stays, business continuity, household instructions, account recovery notes and cryptocurrency recovery instructions: anything someone may need if you can’t respond.",
        links: [{ label: "Browse scenarios", to: "/scenarios" }],
      },
    ],
  },
  {
    id: "security",
    title: "Security and privacy",
    items: [
      {
        question: "Can you read my files?",
        answer:
          "Not as part of normal operation, but it is technically possible. Files are encrypted in your browser and your vault passphrase never reaches us. However, each file key is also locked with an emergency-release key that our servers can use through AWS Key Management Service, so your recipients can open files without your passphrase. That means AnyCircumstances is not zero-knowledge: someone with privileged access to our production systems could technically decrypt a file.",
        links: [{ label: "Read the full security explanation", to: "/security#can-you-read" }],
      },
      {
        question: "Where are my files encrypted?",
        answer:
          "In your browser, before upload. Each file gets its own AES-256 key. File contents are encrypted; file names, types and sizes are not, so give sensitive files a neutral name.",
        links: [{ label: "What we store", to: "/security#stored" }],
      },
      {
        question: "Is there two-factor authentication?",
        answer:
          "Not yet. Your account is protected by your password, and opening your vault or changing important settings also needs your check-in PIN or password. Password and PIN resets go through your email, so protect your email account with two-step verification.",
        links: [{ label: "If you lose something", to: "/security#recovery" }],
      },
      {
        question: "Do you sell or share my data?",
        answer:
          "We don’t sell or rent your data. We use service providers to host the service, send email and process payments. The Privacy Policy lists them.",
        links: [{ label: "Privacy Policy", to: "/privacy" }],
      },
    ],
  },
  {
    id: "keys",
    title: "Passwords, PINs and recovery",
    items: [
      {
        question: "What’s the difference between my password, vault passphrase and PINs?",
        answer:
          "Your account password signs you in. Your vault passphrase (set when you first upload a file) encrypts your files; it never leaves your browser and can’t be reset. Your check-in PIN (4–6 digits) confirms check-ins and sensitive actions. Your emergency PIN is a different 4–6 digit PIN: entering it immediately sends your emergency contacts their files.",
      },
      {
        question: "What does the emergency PIN do?",
        answer:
          "Entering it where you’d normally enter your check-in PIN immediately emails your verified emergency contacts their links. There is no delay and it can’t be undone. The screen looks like a normal check-in, so it can be used under pressure. Entering it in the cancel-plan or delete-account confirmation also starts delivery and locks the account for 24 hours instead of cancelling or deleting.",
        links: [{ label: "Check-in settings (sign-in required)", to: "/app/verification" }],
      },
      {
        question: "What if I forget my vault passphrase?",
        answer:
          "We can’t reset or recover it, so you won’t be able to open your own files in the app. Your files remain stored, and emergency delivery to your assigned contacts still works. Keep your passphrase somewhere safe.",
        links: [{ label: "Recovery details", to: "/security#recovery" }],
      },
      {
        question: "What if I forget my password or PIN?",
        answer:
          "Reset your password from the sign-in page with a link sent to your email. Reset your check-in and emergency PINs together in Check-in settings using your password and an emailed code. Neither affects your encrypted files.",
        links: [
          { label: "Reset password", to: "/forgot-password" },
          { label: "Check-in settings (sign-in required)", to: "/app/verification" },
        ],
      },
      {
        question: "What if I get a new phone or computer?",
        answer:
          "Sign in on the new device and unlock your vault with your vault passphrase. Your vault key is backed up to your account in encrypted form.",
      },
    ],
  },
  {
    id: "check-ins",
    title: "Check-ins",
    items: [
      {
        question: "How do I check in?",
        answer:
          "Sign in and enter your check-in PIN on the Check-in page. Monthly and weekly plans check in every 30 or 7 days; the Daily / scheduled plan can use daily or custom recurring days and times. A successful check-in advances the due date, while a scheduled plan keeps its chosen calendar.",
        links: [{ label: "Check in (sign-in required)", to: "/app/check-in" }],
      },
      {
        question: "What happens if I miss a check-in?",
        answer:
          "Nothing is released straight away. Your grace period starts: you choose 6 to 72 hours. During it you get 1 to 5 reminder emails (your choice). Check in before it ends and the pending release stops.",
        links: [{ label: "Change grace period and reminders (sign-in required)", to: "/app/verification" }],
      },
      {
        question: "Can I set a one-off timer, for example for a trip?",
        answer:
          "A one-off timer isn’t available, but the paid Daily / scheduled tier lets you choose calendar dates, weekdays, every N days or alternate weeks, and a time zone. Your chosen grace period still applies after a missed due time; editing a schedule cannot clear an overdue check-in.",
      },
      {
        question: "Does missing a check-in mean AnyCircumstances thinks I died?",
        answer:
          "No. AnyCircumstances doesn’t decide why a check-in was missed. It only follows the schedule, reminders and grace period you set.",
      },
    ],
  },
  {
    id: "recipients",
    title: "Recipients and delivery",
    items: [
      {
        question: "What do my recipients receive?",
        answer:
          "Each verified contact gets one email with a secure link for each file you assigned to them. Files aren’t attached to the email and nothing is published online. Contacts with no files assigned receive nothing.",
        links: [{ label: "See a sample email and walkthrough", to: "/recipients" }],
      },
      {
        question: "Do recipients need an account?",
        answer:
          "No. When you add someone, they get a confirmation email and click a link (valid for 2 days; you can resend it). Only confirmed contacts can receive files. At release, they open their links in a browser without creating an account.",
        links: [{ label: "Emergency contacts (sign-in required)", to: "/app/emergency-contacts" }],
      },
      {
        question: "What if a recipient’s email address changes?",
        answer:
          "Edit the contact and send the confirmation email again. Changing the address removes their confirmed status until they confirm the new address. Releases go to whatever address is saved, so keep it current.",
        links: [{ label: "Emergency contacts (sign-in required)", to: "/app/emergency-contacts" }],
      },
      {
        question: "What if the email doesn’t arrive or the link stops working?",
        answer:
          "Delivery is by email only, and we can’t detect bounced emails. Tell your recipients to expect an email from AnyCircumstances and to check spam folders. Each link can be opened once, works for 20 minutes in that browser and expires after 30 days by default. Links can’t currently be re-sent.",
        links: [{ label: "Recipient limitations", to: "/recipients#limitations" }],
      },
    ],
  },
  {
    id: "billing",
    title: "Billing, cancellation and your data",
    items: [
      {
        question: "How does billing and renewal work?",
        answer:
          "Monthly plans are charged every month and annual plans once a year, through Stripe. Both renew automatically until cancelled. Annual plans cost 10 times the monthly price.",
        links: [{ label: "Pricing", to: "/pricing" }],
      },
      {
        question: "How do I cancel, and what happens to my files?",
        answer:
          "Cancel from Account settings. Cancelling there ends your plan immediately (including annual plans) and permanently deletes your stored files. Payments are non-refundable, as described in the Terms. Download anything you need first.",
        links: [
          { label: "Account settings (sign-in required)", to: "/app/settings" },
          { label: "Terms", to: "/terms" },
        ],
      },
      {
        question: "What happens if a payment fails?",
        answer: "Access to your vault is paused until the payment is fixed. You can update your payment method from the Billing page.",
        links: [{ label: "Billing (sign-in required)", to: "/app/billing" }],
      },
      {
        question: "Can I export my files?",
        answer: "There’s no bulk export. While your plan is active you can download and decrypt files one at a time from your vault.",
      },
      {
        question: "Can I delete my account?",
        answer:
          "Yes, from Account settings. Deleting your account removes your files, contacts, check-in history and pending emergency links. Links that were already sent stop working.",
        links: [{ label: "Account settings (sign-in required)", to: "/app/settings" }],
      },
      {
        question: "How do I contact support?",
        answer: "Email contact@anycircumstances.com from the address on your account.",
        links: [{ label: "Contact", to: "/contact" }],
      },
    ],
  },
];

export const faqs: FaqItem[] = faqGroups.flatMap((group) => group.items);
