import content from "@/data/publicContent.json";
import { breadcrumbSchema } from "@/components/seo/schema";

const SITE_URL = "https://anycircumstances.com";

export type PublicRouteSeo = {
  path: string;
  title: string;
  description: string;
  type?: "website" | "article";
  schema: Record<string, unknown> | Record<string, unknown>[];
};

const page = (path: string, title: string, description: string): PublicRouteSeo => ({
  path,
  title,
  description,
  type: "website",
  schema: [{
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url: `${SITE_URL}${path}`,
    isPartOf: { "@id": `${SITE_URL}/#website` },
  }, ...(path === "/emergency-information-vault" || path === "/proof-of-life" ? [breadcrumbSchema([{ name: "Home", path: "/" }, { name: path === "/proof-of-life" ? "Proof of Life" : "Emergency Information Vault", path }])] : [])],
});

export const publicRoutes: PublicRouteSeo[] = [
  page("/", "Secure Emergency Digital Vault & Dead Man’s Switch | AnyCircumstances", "Make sure your family can get to important documents when you can’t. Encrypted vault, scheduled check-ins, and secure email delivery to the people you choose."),
  page("/dead-mans-switch", content.switch.title, content.switch.description),
  page("/digital-vault", "Secure Digital Vault for Important Documents | AnyCircumstances", "A personal digital vault for encrypted documents, emergency information, recovery instructions, and controlled delivery to trusted recipients."),
  page("/emergency-information-vault", "Emergency Information Vault for Family | AnyCircumstances", "Organize important documents, contacts, account instructions, insurance information, recovery details, and emergency files for trusted recipients."),
  page("/features", "Encrypted Vault, Trusted Recipients & Check-Ins | AnyCircumstances", "Explore client-side file encryption, scheduled check-ins, trusted recipients, selective sharing, and secure emergency delivery."),
  page("/how-it-works", "How AnyCircumstances Check-Ins & Emergency Delivery Work", "See the full flow: encrypted files, trusted recipients, scheduled check-ins, email reminders, a customizable grace period, and secure recipient delivery."),
  page("/recipients", "What Emergency Recipients Receive | AnyCircumstances", "See how emergency contacts confirm, what the delivery email looks like, how recipients open files without an account, and the limits of email delivery."),
  page("/proof-of-life","Proof of Life Protocol & Digital Check-Ins | AnyCircumstances", "Learn how recurring digital proof-of-life check-ins, PIN confirmation, reminders, and a grace period can control secure information release."),
  page("/pricing", "Secure Digital Vault Pricing | AnyCircumstances", "Compare AnyCircumstances plans for encrypted storage, trusted contacts, check-ins, and emergency file delivery."),
  page("/security", "Digital Vault Security & Encryption | AnyCircumstances", "How files are encrypted in your browser, what AnyCircumstances stores, who can decrypt what, how recipients open files, and what happens if you lose your passphrase."),
  page("/about", "About AnyCircumstances | Emergency Information Planning", "Learn why AnyCircumstances helps people prepare important encrypted information for trusted contacts."),
  page("/faq", "Digital Vault & Dead Man’s Switch FAQ | AnyCircumstances", "Answers about encrypted storage, scheduled check-ins, trusted contacts, emergency delivery, billing, and account security."),
  page("/guides", "Emergency Planning & Digital Inheritance Guides | AnyCircumstances", "Practical guides to emergency information, important documents, passwords, cryptocurrency access, and controlled digital release."),
  page("/scenarios", "Emergency Planning Ideas & Scenarios | AnyCircumstances", "Explore practical ways to prepare private information for family, travel, business continuity, and unexpected emergencies."),
  page("/contact", "Contact AnyCircumstances", "Contact the AnyCircumstances team for product and account support."),
  page("/privacy", "Privacy Policy | AnyCircumstances", "Read the AnyCircumstances privacy policy."),
  page("/terms", "Terms of Service | AnyCircumstances", "Read the AnyCircumstances terms of service."),
  page("/accessibility", "Accessibility | AnyCircumstances", "Read the AnyCircumstances accessibility commitment and provide feedback."),
];

const routeMap = new Map(publicRoutes.map((route) => [route.path, route]));

export function getPublicRouteSeo(pathname: string) {
  const normalized = pathname === "/" ? "/" : pathname.replace(/\/$/, "");
  return routeMap.get(normalized);
}
