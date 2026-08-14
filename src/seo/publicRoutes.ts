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
  schema: {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url: `${SITE_URL}${path}`,
    isPartOf: { "@id": `${SITE_URL}/#website` },
  },
});

export const publicRoutes: PublicRouteSeo[] = [
  page("/", "Secure Emergency Digital Vault & Dead Man’s Switch | AnyCircumstances", "Store encrypted files, choose trusted recipients, and use scheduled check-ins to release important information if you become unavailable."),
  page("/dead-mans-switch", "Digital Dead Man’s Switch for Files & Family | AnyCircumstances", "Use scheduled check-ins to trigger secure delivery of encrypted documents and instructions to trusted contacts if you become unavailable."),
  page("/digital-vault", "Secure Digital Vault for Important Information | AnyCircumstances", "Securely store important documents, recovery details, and emergency information, then control when trusted recipients can receive access."),
  page("/emergency-information-vault", "Emergency Information Vault for Your Family | AnyCircumstances", "Organize important documents, contacts, account instructions, insurance details, and emergency information for people you trust."),
  page("/features", "Encrypted Vault, Trusted Recipients & Check-Ins | AnyCircumstances", "Explore client-side file encryption, scheduled check-ins, trusted recipients, selective sharing, and secure emergency delivery."),
  page("/how-it-works", "How Secure Emergency Information Delivery Works | AnyCircumstances", "See how to encrypt files, select trusted contacts, schedule check-ins, and prepare controlled emergency delivery."),
  page("/pricing", "Secure Digital Vault Pricing | AnyCircumstances", "Compare AnyCircumstances plans for encrypted storage, trusted contacts, check-ins, and emergency file delivery."),
  page("/security", "Digital Vault Security & Encryption | AnyCircumstances", "Learn how AnyCircumstances encrypts files on your device, stores ciphertext, protects accounts, and handles controlled recovery."),
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
