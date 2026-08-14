export type GuideSection = { heading: string; paragraphs?: string[]; items?: string[] };
export type Guide = { slug: string; title: string; seoTitle: string; description: string; published: string; modified: string; sections: GuideSection[]; related: Array<{ label: string; path: string }> };

export const guides: Guide[] = [
  {
    slug: "emergency-information-checklist",
    title: "Emergency Information Checklist for Your Family",
    seoTitle: "Emergency Information Checklist for Families | AnyCircumstances",
    description: "A practical checklist of documents, contacts, account details, and instructions your family may need during an emergency.",
    published: "2026-08-14", modified: "2026-08-14",
    sections: [
      { heading: "Start with the information that saves time", paragraphs: ["An emergency file should help someone take the next useful action without guessing. Begin with names, phone numbers, locations, and short instructions. A complete archive is less helpful than a clear, current plan."], items: ["Your full legal name, address, and date of birth", "Two emergency contacts and how they know you", "Doctors, pharmacy, insurer, attorney, accountant, and employer contacts", "Where original documents and physical keys are kept"] },
      { heading: "Important documents", items: ["Identification and passport copies", "Insurance policies and claim numbers", "Property deeds, leases, vehicle titles, and loan information", "Estate documents and the location of signed originals", "Business ownership and continuity documents"] },
      { heading: "Accounts and digital access", paragraphs: ["List services and recovery steps, but avoid putting every live password into an unprotected document. A password manager, encrypted export, or separate recovery instructions may be safer."], items: ["Primary email and mobile carrier", "Banking, utilities, subscriptions, and recurring bills", "Password manager emergency-access instructions", "Device passcodes only where disclosure is appropriate", "Cryptocurrency wallet locations and tested recovery directions"] },
      { heading: "Medical, household, and dependent care", items: ["Medications, allergies, conditions, and preferred hospital", "Children’s school and caregiver contacts", "Pet feeding, medication, veterinarian, and temporary caregiver instructions", "Home alarm, utilities, vehicles, and urgent maintenance notes"] },
      { heading: "Keep the checklist usable", paragraphs: ["Name a person who will review the plan with you. Tell them that the information exists and how access works. Review it after a move, major purchase, relationship change, new account, or at least twice a year. Never treat a checklist as a substitute for legal or medical advice."] },
    ],
    related: [{ label: "Build an emergency information vault", path: "/emergency-information-vault" }, { label: "Compare a digital emergency binder", path: "/guides/digital-emergency-binder" }, { label: "See secure vault features", path: "/digital-vault" }],
  },
  {
    slug: "digital-emergency-binder", title: "How to Build a Digital Emergency Binder", seoTitle: "Digital Emergency Binder: What to Include & How to Secure It", description: "Build a useful digital emergency binder without leaving sensitive documents exposed or instructions out of date.", published: "2026-08-14", modified: "2026-08-14",
    sections: [
      { heading: "What a digital emergency binder is", paragraphs: ["A digital emergency binder is an organized set of documents and instructions that helps trusted people respond when you cannot. Unlike a paper binder, it can be updated remotely and protected with encryption—but only if storage, access, and recovery are planned carefully."] },
      { heading: "Use a simple structure", items: ["Read first: immediate contacts and priorities", "Identity and legal documents", "Medical and insurance information", "Home, property, vehicle, and dependent care", "Accounts, devices, and digital recovery", "Personal wishes and letters"] },
      { heading: "Separate the map from the secrets", paragraphs: ["Your binder can identify accounts and explain recovery without containing every credential in plain text. Keep high-risk secrets in an appropriate encrypted system and use the binder to explain where they are and who is authorized to recover them."] },
      { heading: "Plan access before an emergency", items: ["Choose one or two trusted recipients", "Test that notifications reach them", "Explain what triggers access", "Keep signed legal originals where your adviser recommends", "Review permissions whenever relationships change"] },
      { heading: "Paper binder, cloud folder, or controlled vault?", paragraphs: ["Paper works during some outages but is easy to lose or copy. A shared cloud folder is convenient but usually grants immediate access. A controlled emergency vault adds encryption and release rules, making it useful when information should remain private until a defined event."] },
    ], related: [{ label: "Use the emergency checklist", path: "/guides/emergency-information-checklist" }, { label: "Learn about controlled release", path: "/dead-mans-switch" }, { label: "Explore the emergency vault", path: "/emergency-information-vault" }],
  },
  {
    slug: "important-documents-family-should-know", title: "Important Documents Your Family Should Know About", seoTitle: "Important Documents Your Family Should Know About", description: "A clear guide to the documents, locations, contacts, and instructions family members may need if you become unavailable.", published: "2026-08-14", modified: "2026-08-14",
    sections: [
      { heading: "They need a map, not necessarily a copy", paragraphs: ["Family members should know that important records exist, where authoritative originals are held, and whom to contact. Giving everyone permanent access to every sensitive document can create unnecessary risk."] },
      { heading: "Identity and family records", items: ["Birth, marriage, divorce, adoption, and citizenship records", "Passport and identification details", "Military service and benefit records", "Names and contact details for close family"] },
      { heading: "Money, property, and insurance", items: ["Financial institution and adviser list", "Insurance carriers, policy types, and claim contacts", "Mortgage, lease, title, deed, and safe-deposit information", "Tax preparer and location of recent returns", "Recurring obligations that cannot be missed"] },
      { heading: "Legal and care instructions", items: ["Will, trust, powers of attorney, and location of signed originals", "Attorney and executor or trustee contacts", "Advance directive and health-care agent", "Care instructions for children, pets, or other dependents"] },
      { heading: "Confirm access while you can", paragraphs: ["Ask a trusted person to follow the map during a test. Fix missing contact details, outdated file names, and instructions that depend on your memory. Legal authority varies by location and account, so coordinate the plan with qualified professionals."] },
    ], related: [{ label: "Emergency information checklist", path: "/guides/emergency-information-checklist" }, { label: "How to store important documents", path: "/digital-vault" }, { label: "Leave passwords responsibly", path: "/guides/how-to-leave-passwords-to-family" }],
  },
  {
    slug: "how-to-leave-passwords-to-family", title: "How to Leave Passwords and Account Access to Family", seoTitle: "How to Leave Passwords to Family Safely | AnyCircumstances", description: "Plan how family can find and recover important online accounts without placing passwords in an exposed note or document.", published: "2026-08-14", modified: "2026-08-14",
    sections: [
      { heading: "Do not start with a plain-text password list", paragraphs: ["A printed list, email draft, or ordinary cloud document can expose every account at once. Start by identifying which accounts matter, what the provider permits, and who should have authority to act."] },
      { heading: "Create an account inventory", items: ["Primary email and phone number", "Password manager and recovery method", "Banking, insurance, utilities, and subscriptions", "Cloud storage, social media, domains, and business systems", "Devices and authentication methods"] },
      { heading: "Use provider recovery and legacy tools", paragraphs: ["Some services offer legacy contacts, inactive-account settings, recovery contacts, or estate procedures. Configure those features directly and document what your family should expect. Access rights are not created merely by knowing a password."] },
      { heading: "Protect two-factor authentication", items: ["Keep backup codes encrypted", "Explain where hardware security keys are stored", "Document how a phone number or device can be recovered", "Avoid making one unavailable device the only path to every account"] },
      { heading: "Test and update the plan", paragraphs: ["A trusted person should understand the process without receiving premature access. Review the inventory when you change email, phones, password managers, or key financial accounts. Consult an attorney for authority and estate questions."] },
    ], related: [{ label: "Secure important files in a digital vault", path: "/digital-vault" }, { label: "Understand automatic release", path: "/dead-mans-switch" }, { label: "Documents family should know", path: "/guides/important-documents-family-should-know" }],
  },
  {
    slug: "what-happens-to-crypto-when-you-die", title: "What Happens to Cryptocurrency When You Die?", seoTitle: "What Happens to Crypto When You Die? A Practical Plan", description: "Understand custody, recovery phrases, access risks, and the practical steps needed to prepare cryptocurrency for heirs.", published: "2026-08-14", modified: "2026-08-14",
    sections: [
      { heading: "Crypto does not automatically transfer", paragraphs: ["A blockchain does not know that an owner has died. Assets remain controlled by whoever can satisfy the wallet or custodian’s access rules. Without a valid recovery path, self-custodied assets may be permanently inaccessible."] },
      { heading: "Custodial and self-custody accounts differ", paragraphs: ["An exchange may have an estate-claims process and identity requirements. A self-custody wallet generally depends on keys, recovery phrases, devices, passphrases, or multisignature participants. Your plan should identify which model applies to each holding."] },
      { heading: "Build instructions without creating a theft kit", items: ["Inventory wallets and custodians without exposing keys", "Document devices, wallet software, and any additional passphrase", "Store recovery material encrypted and separately from public instructions", "Name the appropriate legal and technical contacts", "Test recovery with a spare wallet or documented procedure"] },
      { heading: "Common failure cases", items: ["A recovery phrase exists but nobody knows where", "Instructions omit an additional wallet passphrase", "A hardware wallet fails and no tested backup exists", "One person receives both the secret and immediate authority too early", "Tax and legal obligations are ignored"] },
      { heading: "Coordinate technical and legal planning", paragraphs: ["Possession of a key and legal ownership are different questions. Work with qualified estate and tax advisers in your jurisdiction, keep values and account details current, and never publish recovery material in a will that may become public."] },
    ], related: [{ label: "Learn about digital dead man’s switches", path: "/dead-mans-switch" }, { label: "Prepare an emergency vault", path: "/emergency-information-vault" }, { label: "Leave account access to family", path: "/guides/how-to-leave-passwords-to-family" }],
  },
  {
    slug: "dead-mans-switch-vs-digital-will", title: "Dead Man’s Switch vs. Digital Will", seoTitle: "Dead Man’s Switch vs Digital Will: Key Differences", description: "Compare automated information release with legal estate instructions, including what each can and cannot do.", published: "2026-08-14", modified: "2026-08-14",
    sections: [
      { heading: "They solve different problems", paragraphs: ["A digital dead man’s switch is a technical workflow that reacts to missed check-ins and can deliver selected information. A will is a legal instrument that directs how an estate should be handled after death. One does not replace the other."] },
      { heading: "What a dead man’s switch can do", items: ["Request check-ins on a schedule", "Apply reminders or a grace period", "Release selected encrypted files or instructions", "Notify chosen contacts when configured conditions are met"] },
      { heading: "What a will can do", items: ["Nominate an executor where local law allows", "Direct distribution of estate property", "Address guardianship and other legal wishes", "Work with trusts, beneficiary designations, and probate rules"] },
      { heading: "Where each can fail", paragraphs: ["A switch can trigger because of missed messages, travel, illness, or outdated contact details. A will can be hard to locate, may become public, and should not contain live passwords or recovery phrases. Both require maintenance and a tested communication plan."] },
      { heading: "Use them together carefully", paragraphs: ["Legal documents can establish authority while a secure information plan helps the authorized person locate records and take practical steps. Configure generous recovery safeguards, avoid premature disclosure, and review the arrangement with an estate professional."] },
    ], related: [{ label: "How a digital dead man’s switch works", path: "/dead-mans-switch" }, { label: "Important family documents", path: "/guides/important-documents-family-should-know" }, { label: "Review security details", path: "/security" }],
  },
];

export const guideBySlug = Object.fromEntries(guides.map((guide) => [guide.slug, guide]));
