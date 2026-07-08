import { Link } from "react-router-dom";
import { HelpCircle } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FaqPage = () => {
  const faqs = [
    {
      question: "What does this service do?",
      answer: (
        <>
          <p className="mb-3">
            We let you securely store important files and designate trusted
            contacts. You choose how often you check in (daily, weekly, or
            monthly). If you ever stop confirming that you're okay, the system
            automatically sends your selected files to the people you chose.
          </p>
          <p>
            It's a simple way to make sure the right people can access what they
            need if something ever happens to you.
          </p>
        </>
      ),
    },
    {
      question: "What kinds of files can I upload?",
      answer: (
        <>
          <p className="mb-3">
            You can upload most common file types, including:
          </p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground mb-3">
            <li>PDFs and documents</li>
            <li>photos and scans</li>
            <li>audio and video files</li>
            <li>ZIP archives and other attachments</li>
          </ul>
          <p>
            If it's important to you or your loved ones, you can store it here.
          </p>
        </>
      ),
    },
    {
      question: "Who will see my files?",
      answer: (
        <>
          <p className="mb-3">Only:</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground mb-3">
            <li>you</li>
            <li>and the trusted contacts you choose, if your check-ins stop</li>
          </ul>
          <p>
            Until that condition is met, your files remain private and
            encrypted. We don't browse, sell, or share them.
          </p>
        </>
      ),
    },
    {
      question: "How is my data protected?",
      answer: (
        <>
          <p className="mb-3">
            We protect your information in two main ways:
          </p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground mb-3">
            <li>your data is encrypted while being transferred</li>
            <li>your data is encrypted while it's stored</li>
          </ul>
          <p className="mb-3">
            We use modern standards such as AES-256 encryption for stored files
            and TLS for data in transit, similar to what banks and modern
            operating systems rely on.
          </p>
          <p>
            You can also enable two-factor authentication on your account for an
            additional layer of login protection.
          </p>
        </>
      ),
    },
    {
      question: "Can you read my files?",
      answer: (
        <>
          <p className="mb-3">
            No. Your files are stored in encrypted form and handled
            automatically by our system. They are not used for advertising,
            analytics resale, or training AI models.
          </p>
          <p>
            Access is limited, audited, and only used to operate the service you
            signed up for.
          </p>
        </>
      ),
    },
    {
      question: "What happens if I miss a check-in by accident?",
      answer: (
        <>
          <p className="mb-3">You control your settings.</p>
          <p className="mb-3">You can:</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground mb-3">
            <li>choose daily, weekly, or monthly reminders</li>
            <li>set grace periods</li>
            <li>adjust notifications</li>
          </ul>
          <p>
            We give you multiple reminders before your information is ever
            released to your trusted contacts, and you can cancel a pending
            release at any time while you still have access to your account.
          </p>
        </>
      ),
    },
    {
      question: "What happens when my files are released?",
      answer: (
        <>
          <p className="mb-3">
            Only the people you chose receive your files.
          </p>
          <p className="mb-3">You decide:</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground mb-3">
            <li>who receives them</li>
            <li>which files go to which person</li>
            <li>when release should happen</li>
          </ul>
          <p>
            Nothing is posted publicly. Nothing goes to anyone you didn't
            explicitly select.
          </p>
        </>
      ),
    },
    {
      question: "Can I change or remove trusted contacts?",
      answer: (
        <>
          <p className="mb-3">Yes.</p>
          <p className="mb-3">At any time you can:</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground mb-3">
            <li>add new contacts</li>
            <li>remove contacts</li>
            <li>change who receives what</li>
            <li>cancel a planned delivery</li>
          </ul>
          <p>You stay in control of your account the entire time.</p>
        </>
      ),
    },
    {
      question: "Can I delete my data?",
      answer: (
        <>
          <p className="mb-3">Yes.</p>
          <p className="mb-3">You can delete:</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground mb-3">
            <li>individual files</li>
            <li>your entire account</li>
          </ul>
          <p>
            When you delete information, it is removed from our active systems
            instead of being kept forever "just in case."
          </p>
        </>
      ),
    },
    {
      question: "Do you sell or share my data?",
      answer: (
        <>
          <p className="mb-3">No.</p>
          <p className="mb-3">We do not:</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground mb-3">
            <li>sell your information</li>
            <li>rent it</li>
            <li>use it for targeted advertising</li>
            <li>resell it to brokers</li>
          </ul>
          <p>Your data is used only to operate the service you chose.</p>
        </>
      ),
    },
    {
      question: "How much does it cost?",
      answer: (
        <>
          <p className="mb-3">
            We keep pricing simple and based on how much storage you use. You
            can see the current plans and storage limits on our Pricing page.
          </p>
          <p>There are no hidden "activation" or "download" fees.</p>
        </>
      ),
    },
    {
      question: "Do I have to use two-factor authentication?",
      answer: (
        <>
          <p className="mb-3">It's optional but recommended.</p>
          <p>
            Two-factor authentication (2FA) adds a second step to logging in,
            using an app like Google Authenticator. Even if someone has your
            password, they still can't sign in without your verification code.
          </p>
        </>
      ),
    },
    {
      question:
        "What if I get a new phone or lose access to my authenticator app?",
      answer: (
        <p>
          You'll be able to regain access using your recovery options. We
          strongly recommend saving your backup codes somewhere secure when you
          enable 2FA.
        </p>
      ),
    },
    {
      question: "Is this meant only for end-of-life situations?",
      answer: (
        <>
          <p className="mb-3">Not at all.</p>
          <p className="mb-3">People use it for:</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground mb-3">
            <li>travel and adventure safety</li>
            <li>storing legal and financial documents</li>
            <li>making sure partners or family members can access accounts</li>
            <li>business continuity and digital assets</li>
          </ul>
          <p>
            Think of it as "digital peace of mind," not something morbid.
          </p>
        </>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      
        <div className="mb-6 text-sm text-muted-foreground">
          <span className="mr-2">Related:</span>
          <Link to="/digital-vault" className="underline underline-offset-4 hover:opacity-90 mr-3">secure digital vault</Link>
          <Link to="/dead-mans-switch" className="underline underline-offset-4 hover:opacity-90">dead man’s switch</Link>
        </div>
<section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
            <HelpCircle className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Frequently Asked Questions
          </h1>
          <p className="text-xl text-muted-foreground">
            Find answers to common questions about our service.
          </p>
        </div>
      </section>

      {/* FAQ Accordion */}
      <section className="py-8 px-4 pb-20">
        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="border border-border/50 rounded-lg px-6 bg-card/50 backdrop-blur-sm"
              >
                <AccordionTrigger className="text-left text-foreground hover:no-underline py-5">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </div>
  );
};

export default FaqPage;
