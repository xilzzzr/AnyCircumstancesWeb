import type { CtaVariant } from "./ctas";
export type GuideLink = { label: string; path: string };
export type GuideComparison = { columns: string[]; rows: string[][] };
export type GuideSection = { heading: string; paragraphs?: string[]; items?: string[]; cards?: { heading: string; text: string }[]; ordered?: boolean; callout?: { title: string; text: string }; comparison?: GuideComparison; links?: GuideLink[]; finalParagraph?: string };
export type Guide = { slug: string; title: string; seoTitle: string; description: string; intro: string; published: string; modified: string; category: string; cardTitle?: string; cardDescription?: string; sections: GuideSection[]; comparison?: GuideComparison; related: GuideLink[]; ctaVariant: CtaVariant; ctaAfterSection?: number; showToc?: boolean };

export const guides: Guide[] = [
  {
    "slug": "emergency-information-checklist",
    "title": "Emergency Information Checklist for Your Family",
    "seoTitle": "Emergency Information Checklist for Families | AnyCircumstances",
    "description": "A practical checklist of documents, contacts, account details, and instructions your family may need during an emergency.",
    "published": "2026-08-14",
    "modified": "2026-09-08",
    "sections": [
      {
        "heading": "Start with the information that saves time",
        "items": [
          "Your full legal name, address, and date of birth",
          "Two emergency contacts and how they know you",
          "Doctors, pharmacy, insurer, attorney, accountant, and employer contacts",
          "Where original documents and physical keys are kept"
        ]
      },
      {
        "heading": "Important documents",
        "items": [
          "Identification and passport copies",
          "Insurance policies and claim numbers",
          "Property deeds, leases, vehicle titles, and loan information",
          "Estate documents and the location of signed originals",
          "Business ownership and continuity documents"
        ]
      },
      {
        "heading": "Accounts and digital access",
        "paragraphs": [
          "List services and recovery steps, but avoid putting every live password into an unprotected document. A password manager, encrypted export, or separate recovery instructions may be safer."
        ],
        "items": [
          "Primary email and mobile carrier",
          "Banking, utilities, subscriptions, and recurring bills",
          "Password manager emergency-access instructions",
          "Device passcodes only where disclosure is appropriate",
          "Cryptocurrency wallet locations and tested recovery directions"
        ]
      },
      {
        "heading": "Medical, household, and dependent care",
        "items": [
          "Medications, allergies, conditions, and preferred hospital",
          "Children’s school and caregiver contacts",
          "Pet feeding, medication, veterinarian, and temporary caregiver instructions",
          "Home alarm, utilities, vehicles, and urgent maintenance notes"
        ]
      },
      {
        "heading": "Keep the checklist usable",
        "paragraphs": [
          "Name a person who will review the plan with you. Tell them that the information exists and how access works. Review it after a move, major purchase, relationship change, new account, or at least twice a year. Never treat a checklist as a substitute for legal or medical advice."
        ]
      }
    ],
    "related": [
      {
        "label": "Build an emergency information vault",
        "path": "/emergency-information-vault"
      },
      {
        "label": "Compare a digital emergency binder",
        "path": "/guides/digital-emergency-binder"
      },
      {
        "label": "See secure vault features",
        "path": "/digital-vault"
      }
    ],
    "category": "Digital Vaults & Emergency Information",
    "ctaVariant": "emergency",
    "intro": "An emergency file should help someone take the next useful action without guessing. Begin with names, phone numbers, locations, and short instructions. A complete archive is less helpful than a clear, current plan."
  },
  {
    "slug": "digital-emergency-binder",
    "title": "How to Build a Digital Emergency Binder",
    "seoTitle": "Digital Emergency Binder: What to Include & How to Secure It",
    "description": "Build a useful digital emergency binder without leaving sensitive documents exposed or instructions out of date.",
    "published": "2026-08-14",
    "modified": "2026-09-08",
    "sections": [
      {
        "heading": "Use a simple structure",
        "items": [
          "Read first: immediate contacts and priorities",
          "Identity and legal documents",
          "Medical and insurance information",
          "Home, property, vehicle, and dependent care",
          "Accounts, devices, and digital recovery",
          "Personal wishes and letters"
        ]
      },
      {
        "heading": "Separate the map from the secrets",
        "paragraphs": [
          "Your binder can identify accounts and explain recovery without containing every credential in plain text. Keep high-risk secrets in an appropriate encrypted system and use the binder to explain where they are and who is authorized to recover them."
        ]
      },
      {
        "heading": "Plan access before an emergency",
        "items": [
          "Choose one or two trusted recipients",
          "Test that notifications reach them",
          "Explain what triggers access",
          "Keep signed legal originals where your adviser recommends",
          "Review permissions whenever relationships change"
        ]
      },
      {
        "heading": "Paper binder, cloud folder, or controlled vault?",
        "paragraphs": [
          "Paper works during some outages but is easy to lose or copy. A shared cloud folder is convenient but usually grants immediate access. A controlled emergency vault adds encryption and release rules, making it useful when information should remain private until a defined event."
        ]
      }
    ],
    "related": [
      {
        "label": "Use the emergency checklist",
        "path": "/guides/emergency-information-checklist"
      },
      {
        "label": "Learn about controlled release",
        "path": "/dead-mans-switch"
      },
      {
        "label": "Explore the emergency vault",
        "path": "/emergency-information-vault"
      }
    ],
    "category": "Digital Vaults & Emergency Information",
    "ctaVariant": "emergency",
    "intro": "A digital emergency binder is an organized set of documents and instructions that helps trusted people respond when you cannot. Unlike a paper binder, it can be updated remotely and protected with encryption—but only if storage, access, and recovery are planned carefully."
  },
  {
    "slug": "important-documents-family-should-know",
    "title": "Important Documents Your Family Should Know About",
    "seoTitle": "Important Documents Your Family Should Know About",
    "description": "A clear guide to the documents, locations, contacts, and instructions family members may need if you become unavailable.",
    "published": "2026-08-14",
    "modified": "2026-09-08",
    "sections": [
      {
        "heading": "Identity and family records",
        "items": [
          "Birth, marriage, divorce, adoption, and citizenship records",
          "Passport and identification details",
          "Military service and benefit records",
          "Names and contact details for close family"
        ]
      },
      {
        "heading": "Money, property, and insurance",
        "items": [
          "Financial institution and adviser list",
          "Insurance carriers, policy types, and claim contacts",
          "Mortgage, lease, title, deed, and safe-deposit information",
          "Tax preparer and location of recent returns",
          "Recurring obligations that cannot be missed"
        ]
      },
      {
        "heading": "Legal and care instructions",
        "items": [
          "Will, trust, powers of attorney, and location of signed originals",
          "Attorney and executor or trustee contacts",
          "Advance directive and health-care agent",
          "Care instructions for children, pets, or other dependents"
        ]
      },
      {
        "heading": "Confirm access while you can",
        "paragraphs": [
          "Ask a trusted person to follow the map during a test. Fix missing contact details, outdated file names, and instructions that depend on your memory. Legal authority varies by location and account, so coordinate the plan with qualified professionals."
        ]
      }
    ],
    "related": [
      {
        "label": "Emergency information checklist",
        "path": "/guides/emergency-information-checklist"
      },
      {
        "label": "How to store important documents",
        "path": "/digital-vault"
      },
      {
        "label": "Leave passwords responsibly",
        "path": "/guides/how-to-leave-passwords-to-family"
      }
    ],
    "category": "Family & Account Planning",
    "ctaVariant": "general",
    "intro": "Family members should know that important records exist, where authoritative originals are held, and whom to contact. Giving everyone permanent access to every sensitive document can create unnecessary risk."
  },
  {
    "slug": "how-to-leave-passwords-to-family",
    "title": "How to Leave Passwords and Account Access to Family",
    "seoTitle": "How to Leave Passwords to Family Safely | AnyCircumstances",
    "description": "Plan how family can find and recover important online accounts without placing passwords in an exposed note or document.",
    "published": "2026-08-14",
    "modified": "2026-09-08",
    "sections": [
      {
        "heading": "Create an account inventory",
        "items": [
          "Primary email and phone number",
          "Password manager and recovery method",
          "Banking, insurance, utilities, and subscriptions",
          "Cloud storage, social media, domains, and business systems",
          "Devices and authentication methods"
        ]
      },
      {
        "heading": "Use provider recovery and legacy tools",
        "paragraphs": [
          "Some services offer legacy contacts, inactive-account settings, recovery contacts, or estate procedures. Configure those features directly and document what your family should expect. Access rights are not created merely by knowing a password."
        ]
      },
      {
        "heading": "Protect two-factor authentication",
        "items": [
          "Keep backup codes encrypted",
          "Explain where hardware security keys are stored",
          "Document how a phone number or device can be recovered",
          "Avoid making one unavailable device the only path to every account"
        ]
      },
      {
        "heading": "Test and update the plan",
        "paragraphs": [
          "A trusted person should understand the process without receiving premature access. Review the inventory when you change email, phones, password managers, or key financial accounts. Consult an attorney for authority and estate questions."
        ]
      }
    ],
    "related": [
      {
        "label": "Secure important files in a digital vault",
        "path": "/digital-vault"
      },
      {
        "label": "Understand automatic release",
        "path": "/dead-mans-switch"
      },
      {
        "label": "Documents family should know",
        "path": "/guides/important-documents-family-should-know"
      }
    ],
    "category": "Family & Account Planning",
    "ctaVariant": "general",
    "intro": "A printed list, email draft, or ordinary cloud document can expose every account at once. Start by identifying which accounts matter, what the provider permits, and who should have authority to act."
  },
  {
    "slug": "what-happens-to-crypto-when-you-die",
    "title": "What Happens to Cryptocurrency When You Die?",
    "seoTitle": "What Happens to Bitcoin & Crypto When You Die? | AnyCircumstances",
    "description": "What happens to Bitcoin, Ethereum, wallets, exchange accounts, seed phrases, and other cryptocurrency when the owner dies or becomes unavailable?",
    "published": "2026-08-14",
    "modified": "2026-11-12",
    "sections": [
      {
        "heading": "Crypto does not automatically transfer",
        "paragraphs": [
          "A blockchain does not know that an owner has died. Assets remain controlled by whoever can satisfy the wallet or custodian’s access rules. Without a valid recovery path, self-custodied assets may be permanently inaccessible."
        ]
      },
      {
        "heading": "Custodial and self-custody accounts differ",
        "paragraphs": [
          "An exchange may have an estate-claims process and identity requirements. A self-custody wallet generally depends on keys, recovery phrases, devices, passphrases, or multisignature participants. Your plan should identify which model applies to each holding."
        ]
      },
      {
        "heading": "What happens to Bitcoin when you die?",
        "paragraphs": [
          "Bitcoin remains on the blockchain after its owner dies. The network does not know that a death occurred and does not automatically transfer the coins to an heir. Access still depends on control of the wallet credentials.",
          "If the Bitcoin is held in self-custody, recovery may depend on a seed phrase, private key, hardware wallet, multisignature setup, or another recovery method chosen by the owner. If nobody can reconstruct that access path, the Bitcoin may remain inaccessible indefinitely.",
          "If the Bitcoin is held through an exchange or custodian, the process is different. The provider may have an estate or deceased-account procedure that requires identity documents, legal authority, or other records before access can be transferred."
        ],
        "callout": {
          "title": "The practical problem",
          "text": "Your family can know that you owned Bitcoin and still have no idea where the wallet is, which device matters, which exchange was used, or what recovery process you intended."
        }
      },
      {
        "heading": "What happens to a hardware wallet?",
        "paragraphs": [
          "Finding the device is only part of it. Whoever handles your estate also needs to know which wallet it is, how it was backed up, whether there's an extra passphrase on top of the recovery phrase, and where the backup is kept. A hardware wallet without its backup and PIN is just a small piece of plastic."
        ]
      },
      {
        "heading": "What happens to Ethereum when you die?",
        "paragraphs": [
          "Ethereum creates the same basic access problem as Bitcoin: the blockchain does not automatically know who should inherit control of a wallet. If the assets are self-custodied, access depends on the wallet and recovery method the owner configured.",
          "An Ethereum wallet can also control ERC-20 tokens, stablecoins, NFTs, staking positions, and other assets. That makes it especially important to document what exists and where it is managed instead of leaving somebody with only a wallet address and no context."
        ]
      },
      {
        "heading": "What about Solana, XRP, Litecoin, and stablecoins?",
        "paragraphs": [
          "The specific wallet software and recovery process can vary, but the planning problem is similar. Solana, XRP, Litecoin, USDC, USDT, and other digital assets still depend on somebody knowing that the asset exists, understanding where it is held, and having a legitimate technical and legal path to recover it."
        ]
      },
      {
        "heading": "Self-custody vs exchange custody",
        "comparison": {
          "columns": [
            "Situation",
            "What matters most"
          ],
          "rows": [
            [
              "Bitcoin or crypto in self-custody",
              "Wallet location, recovery method, devices, seed or key management, and clear instructions"
            ],
            [
              "Hardware wallet",
              "Device location, backup method, PIN/recovery process, and instructions that do not depend on memory alone"
            ],
            [
              "Exchange account",
              "Provider identity, account details, 2FA/recovery information, and the exchange's estate or deceased-user process"
            ],
            [
              "Multisignature wallet",
              "Who controls each key, how many signatures are required, and what happens if one signer becomes unavailable"
            ],
            [
              "DeFi or staking position",
              "Wallet access plus instructions explaining the protocol or service involved"
            ]
          ]
        },
        "callout": {
          "title": "Do not confuse access with ownership",
          "text": "Technical access to a wallet is not the same thing as legal ownership of the assets. Estate and inheritance rules vary by jurisdiction. AnyCircumstances can help prepare and conditionally deliver information, but it does not transfer legal ownership of cryptocurrency or replace professional estate planning."
        }
      },
      {
        "heading": "Should you put your seed phrase in a will?",
        "paragraphs": [
          "Usually not. Depending on where you live, a will can be read by several people during the estate process and may become a public record. Anyone who sees a seed phrase can move the funds.",
          "A safer split: the will says who should inherit the crypto, and separate, protected instructions explain how to reach it. Talk to an estate lawyer about the legal side."
        ]
      },
      {
        "heading": "What should your family know?",
        "items": [
          "That you own crypto at all",
          "Which exchanges you use and which email address each account is under",
          "Whether you also hold crypto yourself, in a wallet app or on a hardware wallet",
          "Which devices matter, and where they are",
          "Where the recovery instructions are kept",
          "Which lawyer, accountant or trusted person to contact first",
          "Whether there's a multisignature or other unusual setup",
          "What not to do: never type a recovery phrase into a website, and ignore anyone who contacts them offering to recover the funds"
        ]
      },
      {
        "heading": "Build instructions without creating a theft kit",
        "items": [
          "Inventory wallets and custodians without exposing keys",
          "Document devices, wallet software, and any additional passphrase",
          "Store recovery material encrypted and separately from public instructions",
          "Name the appropriate legal and technical contacts",
          "Test recovery with a spare wallet or documented procedure"
        ],
        "callout": {
          "title": "Do not publish wallet secrets",
          "text": "Never put a seed phrase or private key in a public document or ordinary email. Build a layered plan that tells authorized people what exists and how to follow the appropriate recovery process without unnecessarily exposing raw secrets."
        }
      },
      {
        "heading": "Common failure cases",
        "items": [
          "A recovery phrase exists but nobody knows where",
          "Instructions omit an additional wallet passphrase",
          "A hardware wallet fails and no tested backup exists",
          "One person receives both the secret and immediate authority too early",
          "Tax and legal obligations are ignored"
        ]
      },
      {
        "heading": "A simple plan you can set up this weekend",
        "ordered": true,
        "cards": [
          {
            "heading": "Make a list",
            "text": "Write down every place you hold crypto: each exchange, each wallet app, each hardware wallet. List names and locations only, no keys or phrases."
          },
          {
            "heading": "Note the exchange details",
            "text": "For each exchange, note the account email. Your family will contact the exchange and follow its process for deceased customers, which usually asks for a death certificate and proof of legal authority."
          },
          {
            "heading": "Decide how self-custody will be recovered",
            "text": "Choose where the recovery phrase is kept, for example a sealed envelope in a safe, and whether one person or several people are needed to use it."
          },
          {
            "heading": "Write a start-here letter",
            "text": "Explain what exists, where the recovery material is, who to call first, and what not to do. Keep it short enough to read in a stressful week."
          },
          {
            "heading": "Store the letter somewhere protected",
            "text": "Keep it encrypted, and make sure it only reaches the right person at the right time, not today."
          },
          {
            "heading": "Review it twice a year",
            "text": "Update it when you open or close an account, move funds, or replace a device."
          }
        ]
      },
      {
        "heading": "How AnyCircumstances fits into a crypto plan",
        "paragraphs": [
          "You can store the start-here letter and other instructions as encrypted files and assign them to the person who should receive them. If you stop checking in and your grace period ends, that person gets an email with secure links to those files. AnyCircumstances doesn't hold or move cryptocurrency, and it doesn't transfer ownership."
        ]
      },
      {
        "heading": "Coordinate technical and legal planning",
        "paragraphs": [
          "Possession of a key and legal ownership are different questions. Work with qualified estate and tax advisers in your jurisdiction, keep values and account details current, and never publish recovery material in a will that may become public."
        ],
        "links": [
          {
            "label": "dead man's switch",
            "path": "/dead-mans-switch"
          },
          {
            "label": "secure digital vault",
            "path": "/digital-vault"
          }
        ]
      }
    ],
    "related": [
      {
        "label": "Learn about digital dead man’s switches",
        "path": "/dead-mans-switch"
      },
      {
        "label": "Use a secure digital vault",
        "path": "/digital-vault"
      },
      {
        "label": "Understand proof-of-life check-ins",
        "path": "/guides/proof-of-life-protocol"
      },
      {
        "label": "Review security details",
        "path": "/security"
      },
      {
        "label": "Leave account access to family",
        "path": "/guides/how-to-leave-passwords-to-family"
      }
    ],
    "category": "Crypto & Digital Assets",
    "ctaVariant": "crypto",
    "intro": "Cryptocurrency does not automatically move to a family member when you die. What happens next depends on how the assets are held, whether anyone knows they exist, whether somebody has legal authority to handle them, and whether the technical recovery path is still usable. With self-custody, losing the necessary keys or recovery information can make the assets permanently inaccessible.",
    "ctaAfterSection": 3
  },
  {
    "slug": "dead-mans-switch-vs-digital-will",
    "title": "Dead Man’s Switch vs. Digital Will",
    "seoTitle": "Dead Man’s Switch vs Digital Will: Key Differences",
    "description": "Compare conditional information release with digital estate instructions, including when each works and why neither replaces a legal will.",
    "published": "2026-08-14",
    "modified": "2026-09-08",
    "sections": [
      {
        "heading": "They solve different problems",
        "paragraphs": [
          "A digital dead man’s switch is a technical workflow that reacts to missed check-ins and can deliver selected information. A digital will generally refers to instructions concerning digital accounts or assets; depending on jurisdiction and execution, it may not itself be a legally valid will. Neither replaces a properly prepared legal will."
        ]
      },
      {
        "heading": "What a dead man’s switch can do",
        "items": [
          "Request check-ins on a schedule",
          "Apply reminders or a grace period",
          "Release selected encrypted files or instructions",
          "Notify chosen contacts when configured conditions are met"
        ]
      },
      {
        "heading": "What a will can do",
        "items": [
          "Nominate an executor where local law allows",
          "Direct distribution of estate property",
          "Address guardianship and other legal wishes",
          "Work with trusts, beneficiary designations, and probate rules"
        ]
      },
      {
        "heading": "Where each can fail",
        "paragraphs": [
          "A switch can trigger because of missed messages, travel, illness, or outdated contact details. A will can be hard to locate, may become public, and should not contain live passwords or recovery phrases. Both require maintenance and a tested communication plan."
        ]
      },
      {
        "heading": "Use them together carefully",
        "paragraphs": [
          "Legal documents can establish authority while a secure information plan helps the authorized person locate records and take practical steps. Configure generous recovery safeguards, avoid premature disclosure, and review the arrangement with an estate professional."
        ]
      },
      {
        "heading": "Where email fits into a dead man's switch",
        "paragraphs": [
          "Many digital dead man's switches use email as the notification channel. In AnyCircumstances, email reminders help the user avoid an accidental trigger, and recipient email is used after the user's check-in and grace-period conditions have expired. The recipient message contains a secure access link for the files assigned to that person."
        ],
        "links": [
          {
            "label": "Read how a dead man's switch email works",
            "path": "/guides/dead-mans-switch-email"
          }
        ]
      }
    ],
    "related": [
      {
        "label": "How a digital dead man’s switch works",
        "path": "/dead-mans-switch"
      },
      {
        "label": "How proof-of-life check-ins work",
        "path": "/guides/proof-of-life-protocol"
      },
      {
        "label": "Important family documents",
        "path": "/guides/important-documents-family-should-know"
      },
      {
        "label": "Review security details",
        "path": "/security"
      }
    ],
    "category": "Dead Man's Switch & Check-Ins",
    "ctaVariant": "switch",
    "intro": "A dead man's switch and a digital will solve different problems. A dead man's switch responds to a missed check-in or another predefined condition. A digital will is a set of instructions about digital property, accounts, or wishes. Neither automatically replaces a legally valid will, and they can be used together.",
    "comparison": {
      "columns": [
        "Question",
        "Dead Man's Switch",
        "Digital Will"
      ],
      "rows": [
        [
          "What starts it?",
          "A missed check-in or predefined trigger",
          "Usually instructions intended for incapacity or death"
        ],
        [
          "Main purpose",
          "Conditional delivery of information or files",
          "Instructions about digital accounts, assets, or wishes"
        ],
        [
          "Automatic?",
          "It can be",
          "Usually depends on the estate or account process"
        ],
        [
          "Replaces a legal will?",
          "No",
          "No"
        ],
        [
          "Can they work together?",
          "Yes",
          "Yes"
        ]
      ]
    },
    "ctaAfterSection": 5
  },
  {
    "slug": "dead-mans-switch-email",
    "title": "How a Dead Man's Switch Email Works",
    "seoTitle": "How a Dead Man's Switch Email Works, Step by Step",
    "description": "How a dead man's switch email works, with three example setups, what to put in the files, what your recipients receive, and mistakes to avoid.",
    "intro": "A dead man's switch email is a system designed to contact someone if you stop responding. A careful system does more than schedule one message for the future. It expects you to check in, reminds you when a check-in is due, gives you extra time if you miss one, and only starts recipient delivery after the full trigger conditions are met.",
    "published": "2026-09-08",
    "modified": "2026-11-12",
    "sections": [
      {
        "heading": "What is a dead man's switch email?",
        "paragraphs": [
          "A dead man's switch is an automated system that waits for a recurring signal from its owner. In an email-based version, email can be used for reminders, warnings, recipient notification, or some combination of the three. The goal is to make sure prepared information can reach another person if the owner stops checking in."
        ],
        "links": [
          {
            "label": "proof-of-life protocol",
            "path": "/guides/proof-of-life-protocol"
          }
        ]
      },
      {
        "heading": "A safer design uses more than one missed deadline",
        "paragraphs": [
          "If sensitive files were released after one forgotten check-in, the system would be too easy to trigger by accident. Travel, illness, a lost phone, a forgotten deadline, an email problem, or a busy week could all create false alarms. A grace period gives the owner another opportunity to respond before anything is released."
        ]
      },
      {
        "heading": "How AnyCircumstances handles the process",
        "ordered": true,
        "cards": [
          {
            "heading": "Choose a check-in schedule",
            "text": "Decide how often the system should expect confirmation from you."
          },
          {
            "heading": "Configure email reminders",
            "text": "Choose the reminders that should be sent around the check-in window."
          },
          {
            "heading": "You check in",
            "text": "Enter your PIN to confirm the check-in."
          },
          {
            "heading": "Miss the scheduled check-in",
            "text": "Your files are not immediately released. The grace period begins."
          },
          {
            "heading": "Respond during the grace period",
            "text": "If you successfully check in before the grace period ends, the pending release stops."
          },
          {
            "heading": "Let the grace period expire",
            "text": "If no successful check-in occurs, the release process begins."
          },
          {
            "heading": "Recipients receive email",
            "text": "Designated recipients are emailed a secure link for accessing the files assigned to them."
          }
        ]
      },
      {
        "heading": "Three example setups",
        "paragraphs": [
          "The right settings depend on your life, not on what sounds safest. These are starting points you can adjust."
        ],
        "cards": [
          {
            "heading": "You travel a lot",
            "text": "Weekly check-ins and the longest grace period, 72 hours, so a long flight or a few days without signal doesn't start a release. Three reminder emails. Your partner receives your travel documents, insurance policy and the contacts they'd need abroad."
          },
          {
            "heading": "You live alone",
            "text": "A scheduled daily check-in, for example every morning at 9:00 in your time zone, with a 24-hour grace period. A sibling or friend nearby receives a note asking them to check on you, your medical information, and where the spare key is. This doesn't replace a medical alert service or calling emergency services."
          },
          {
            "heading": "You hold crypto or run a business",
            "text": "Monthly check-ins, a 72-hour grace period and five reminders, because a release is hard to undo. One person receives a start-here letter about your wallets and accounts; a business partner receives the client list and how to keep the business running."
          }
        ]
      },
      {
        "heading": "What can a dead man's switch email be used for?",
        "cards": [
          {
            "heading": "Emergency instructions",
            "text": "Send trusted people the documents or instructions they may need if you become unavailable."
          },
          {
            "heading": "Family information",
            "text": "Prepare insurance details, account maps, property instructions, contact lists, or other information that would be difficult to reconstruct."
          },
          {
            "heading": "Cryptocurrency recovery context",
            "text": "Prepare encrypted instructions explaining where Bitcoin, Ethereum, hardware wallets, exchange accounts, or recovery information can be found."
          },
          {
            "heading": "Business continuity",
            "text": "Give a business partner or trusted colleague the information required to keep essential systems, vendors, accounts, or client obligations moving."
          },
          {
            "heading": "Private personal information",
            "text": "Prepare information you do not want to share today but would want somebody to receive under specific conditions."
          }
        ]
      },
      {
        "heading": "What to put in the files",
        "paragraphs": [
          "Think about the first week after something happens to you. What would the person need to find, call or decide? Start with that."
        ],
        "items": [
          "A short start-here note: what to do first and who to call",
          "Where your important documents are, plus copies of the ones that matter most",
          "Insurance policies, with the policy number and the phone number to call",
          "Your lawyer, accountant, employer, landlord and doctor",
          "How to get into your password manager or main email account, if the provider allows it",
          "Instructions for children, pets or anyone who depends on you",
          "What not to do yet, for example not closing an account until a certain bill is paid"
        ],
        "finalParagraph": "Give each person only what they need. In AnyCircumstances you assign files to each recipient separately, and you can add a note to a file explaining what it's for."
      },
      {
        "heading": "What your recipients receive",
        "paragraphs": [
          "Recipients first confirm their email address when you add them. If a release starts, each one gets an email from AnyCircumstances with secure links to the files assigned to them. They don't need an account to open the files.",
          "Unopened links expire after 30 days by default, and links can't be sent again. Tell your recipients now that this email might one day arrive, and ask them to check their spam folder if they're expecting it."
        ],
        "links": [
          {
            "label": "what recipients receive",
            "path": "/recipients"
          }
        ]
      },
      {
        "heading": "Does a dead man's switch prove somebody died?",
        "paragraphs": [
          "No. A missed check-in only means the configured check-in did not happen. The system cannot know whether the reason was death, injury, travel, loss of connectivity, a forgotten deadline, or something else. A dead man's switch should therefore be treated as a conditional information-delivery tool, not as proof of death."
        ]
      },
      {
        "heading": "Dead man's switch email vs scheduled email",
        "comparison": {
          "columns": [
            "Feature",
            "Scheduled email",
            "Dead man's switch email"
          ],
          "rows": [
            [
              "Requires recurring check-ins",
              "No",
              "Yes"
            ],
            [
              "Designed around missed responses",
              "No",
              "Yes"
            ],
            [
              "Can use reminders before release",
              "Usually no",
              "Yes"
            ],
            [
              "Can use a grace period",
              "Usually no",
              "Yes"
            ],
            [
              "Can connect to encrypted files",
              "Not necessarily",
              "Yes, depending on the service"
            ],
            [
              "Designed for emergency information",
              "Not specifically",
              "Yes"
            ]
          ]
        }
      },
      {
        "heading": "Mistakes to avoid",
        "items": [
          "Choosing daily check-ins, then traveling somewhere without signal",
          "A grace period shorter than the longest time you're normally offline",
          "Leaving a recipient's old email address in place after they change it",
          "Not telling recipients to expect the email, so it sits unread in spam",
          "Giving every recipient every file",
          "Forgetting to update the files after you change insurer, bank or wallet",
          "Typing your emergency PIN to see what happens: it sends your files immediately"
        ]
      },
      {
        "heading": "What should you decide before setting one up?",
        "items": [
          "How often you can realistically check in",
          "Which email address you will reliably monitor",
          "How many reminders you want",
          "How long your grace period should be",
          "Which people should receive information",
          "Which files each recipient should receive",
          "How often you will review your contacts and files"
        ],
        "links": [
          {
            "label": "digital dead man's switch",
            "path": "/dead-mans-switch"
          }
        ],
        "finalParagraph": "The best dead man's switch is not the one with the shortest timer. It is the one whose schedule, reminders, grace period, and recipient assignments still make sense when real life gets messy."
      }
    ],
    "related": [
      {
        "path": "/dead-mans-switch",
        "label": "dead man's switch"
      },
      {
        "path": "/how-it-works",
        "label": "See How It Works"
      },
      {
        "path": "/guides/dead-mans-switch-vs-digital-will",
        "label": "Dead Man’s Switch vs. Digital Will"
      },
      {
        "path": "/security",
        "label": "Review security details"
      }
    ],
    "ctaVariant": "switch",
    "category": "Dead Man's Switch & Check-Ins",
    "cardTitle": "How a Dead Man's Switch Email Works",
    "cardDescription": "How recurring check-ins, email reminders, grace periods, and recipient delivery work together."
  },
  {
    "slug": "proof-of-life-protocol",
    "title": "What Is a Proof of Life Protocol?",
    "seoTitle": "What Is a Proof of Life Protocol? How Check-Ins Work",
    "description": "What a proof of life protocol is, how digital check-ins work, and example settings for travel, working abroad, running a business and single parents.",
    "intro": "A proof-of-life protocol is a process that requires a person to periodically confirm that they are still able to respond. In a digital system, that confirmation can be a recurring check-in. If the expected check-in does not happen, the system can begin a predefined escalation process.",
    "published": "2026-09-08",
    "modified": "2026-11-12",
    "sections": [
      {
        "heading": "What does \"proof of life\" mean in a digital system?",
        "paragraphs": [
          "In this context, proof of life does not mean a legal certificate or medical determination. It means a recurring action that shows the account owner still has access and is responding. The system only knows whether the expected check-in happened."
        ]
      },
      {
        "heading": "How a digital proof-of-life check-in works",
        "ordered": true,
        "cards": [
          {
            "heading": "A schedule is created",
            "text": "The user decides how often the system should expect a check-in."
          },
          {
            "heading": "The check-in becomes due",
            "text": "The user is reminded that confirmation is required."
          },
          {
            "heading": "You check in",
            "text": "Enter your PIN to confirm the check-in."
          },
          {
            "heading": "The user does not confirm",
            "text": "The system treats the check-in as missed and begins the configured grace period."
          },
          {
            "heading": "The grace period provides another chance",
            "text": "The user can still check in and stop the pending escalation."
          },
          {
            "heading": "The grace period expires",
            "text": "The system follows the release rules configured in advance."
          }
        ]
      },
      {
        "heading": "How AnyCircumstances uses check-ins",
        "paragraphs": [
          "AnyCircumstances uses recurring check-ins as the trigger layer for its encrypted-file release system. The user chooses the schedule, configures email reminders, sets a grace period, and selects trusted recipients. If the user stops checking in and the grace period eventually expires, recipient delivery begins."
        ]
      },
      {
        "heading": "Proof of life vs dead man's switch",
        "paragraphs": [
          "The check-in is the proof-of-response signal. The dead man's switch is the automation built around the absence of that signal. One asks, \"Did the user respond?\" The other answers, \"What should happen if they do not?\""
        ]
      },
      {
        "heading": "A missed check-in is not proof of death",
        "paragraphs": [
          "A missed check-in can happen for many reasons. Someone may be traveling, sick, offline, locked out of an account, or simply late. AnyCircumstances does not determine why a check-in was missed. It only follows the schedule and grace-period rules the user configured."
        ]
      },
      {
        "heading": "Why a grace period matters",
        "paragraphs": [
          "A grace period reduces the risk that a single missed deadline causes an unintended release. It gives the user additional time to respond while preserving the ability to act automatically if the lack of response continues."
        ]
      },
      {
        "heading": "Common uses for recurring check-ins",
        "items": [
          "emergency information for family",
          "encrypted document delivery",
          "cryptocurrency recovery instructions",
          "business continuity information",
          "private account instructions",
          "travel contingency planning",
          "instructions for dependents or pets"
        ]
      },
      {
        "heading": "Choosing your settings",
        "paragraphs": [
          "In AnyCircumstances you check in with your PIN, monthly, weekly, or on a daily schedule you set (for example weekdays at 8:00). You also choose one to five reminder emails and a grace period between 6 and 72 hours. A few rules of thumb:"
        ],
        "items": [
          "Set the grace period longer than the longest time you're regularly out of reach, like a long-haul flight or a weekend camping trip",
          "Pick more reminders if your inbox is busy and emails get buried",
          "Only choose daily check-ins if you'll really do it every day",
          "If a release would be hard to undo, use a longer schedule and the full 72 hours"
        ],
        "comparison": {
          "columns": ["Your situation", "Suggested settings"],
          "rows": [
            ["At home most of the time, phone always nearby", "Weekly check-ins, 24-hour grace period, 2 reminders"],
            ["Frequent flights or trips without signal", "Weekly check-ins, 72-hour grace period, 3 reminders"],
            ["You want people to know quickly if something is wrong", "Daily check-ins at a set time, 12-hour grace period, 2 reminders"],
            ["Crypto, a business, or anything hard to undo", "Monthly check-ins, 72-hour grace period, 5 reminders"]
          ]
        }
      },
      {
        "heading": "Examples from real situations",
        "cards": [
          {
            "heading": "Working abroad for six months",
            "text": "Weekly check-ins and a 72-hour grace period cover time-zone confusion and patchy internet. A parent at home receives copies of your passport and visa, your employer's contact, and your travel insurance details."
          },
          {
            "heading": "Running a business on your own",
            "text": "Weekly check-ins with a 48-hour grace period. Your accountant or a trusted colleague receives the client list, how to reach your main suppliers, and how to tell customers what's happening."
          },
          {
            "heading": "Single parent",
            "text": "Weekly check-ins with a 24-hour grace period. The person named as your children's guardian receives school and medical details, daily routines, and who to call for childcare in the first few days."
          },
          {
            "heading": "Long hospital stay coming up",
            "text": "Before you go in, check in and raise your grace period to 72 hours. Tell your recipients what to expect, and set it back when you're home."
          }
        ],
        "callout": {
          "title": "Don't test with your emergency PIN",
          "text": "Your emergency PIN starts delivery to your recipients immediately. Use your normal PIN for every check-in."
        }
      },
      {
        "heading": "How often should you check in?",
        "paragraphs": [
          "Choose a schedule you can realistically maintain. A very short schedule creates more opportunities for accidental misses. A very long schedule delays the point at which the system can respond. The right interval depends on how quickly your recipients would need the information and how reliably you can complete the check-in."
        ],
        "links": [
          {
            "label": "dead man's switch",
            "path": "/dead-mans-switch"
          },
          {
            "label": "full check-in flow",
            "path": "/how-it-works"
          }
        ]
      }
    ],
    "related": [
      {
        "path": "/dead-mans-switch",
        "label": "dead man's switch"
      },
      {
        "path": "/how-it-works",
        "label": "See How It Works"
      },
      {
        "path": "/guides/dead-mans-switch-email",
        "label": "How a Dead Man's Switch Email Works"
      },
      {
        "path": "/emergency-information-vault",
        "label": "emergency information vault"
      }
    ],
    "ctaVariant": "switch",
    "category": "Dead Man's Switch & Check-Ins",
    "cardTitle": "What Is a Proof of Life Protocol?",
    "cardDescription": "How recurring digital check-ins can confirm continued response and trigger predefined actions when check-ins stop."
  },
  {
    "slug": "what-is-a-digital-vault",
    "title": "What Is a Digital Vault?",
    "seoTitle": "What Is a Digital Vault? Secure Document Storage Explained",
    "description": "Learn what a digital vault is, what people store in one, how it differs from cloud storage and password managers, and what to look for in a secure vault.",
    "intro": "A digital vault is protected electronic storage for important documents, instructions, and other sensitive information. Unlike an ordinary shared folder, a good digital vault is designed around encryption, controlled access, recovery, and clear rules for who should be able to reach the information.",
    "published": "2026-09-08",
    "modified": "2026-09-08",
    "sections": [
      {
        "heading": "What is a personal digital vault?",
        "paragraphs": [
          "A personal digital vault is a private space for information that belongs to an individual or household. It can hold documents you need today, information somebody else may need later, or instructions that should stay private until a specific situation occurs."
        ]
      },
      {
        "heading": "What do people store in a digital vault?",
        "cards": [
          {
            "heading": "Legal and property documents",
            "text": "Contracts, insurance policies, property records, identification copies, estate documents, and directions to originals."
          },
          {
            "heading": "Financial information",
            "text": "Account maps, investment information, recurring obligations, important contacts, and explanations of what someone should handle first."
          },
          {
            "heading": "Digital account instructions",
            "text": "Password-manager instructions, recovery contacts, backup methods, device information, and notes explaining how important accounts are organized."
          },
          {
            "heading": "Cryptocurrency information",
            "text": "Information about Bitcoin, Ethereum, hardware wallets, exchange accounts, wallet locations, devices, and recovery procedures."
          },
          {
            "heading": "Emergency information",
            "text": "Medical contacts, insurance details, household instructions, caregiver information, pet information, and emergency contact lists."
          },
          {
            "heading": "Personal instructions",
            "text": "Letters, private explanations, business-continuity notes, or other context that would otherwise disappear with the owner's memory."
          }
        ]
      },
      {
        "heading": "Is a digital vault the same as cloud storage?",
        "paragraphs": [
          "No. Cloud storage is primarily designed for syncing, collaboration, and everyday file access. A digital vault is designed around sensitive information, restricted access, and recovery. Some services combine elements of both, but the purpose and access model are different."
        ]
      },
      {
        "heading": "Is a digital vault the same as a password manager?",
        "paragraphs": [
          "No. Password managers are built primarily for credentials and secure notes. A digital vault is better suited to documents, instructions, records, and larger sets of information. The two tools can complement each other instead of replacing one another."
        ]
      },
      {
        "heading": "What is electronic vaulting?",
        "paragraphs": [
          "Electronic vaulting is another term used for securely storing information in an electronic system. The phrase can describe document storage, backup systems, or specialized secure repositories. When comparing services, focus less on the label and more on how encryption, recovery, permissions, and access actually work."
        ]
      },
      {
        "heading": "What should you look for in a secure digital vault?",
        "items": [
          "encryption before upload where supported",
          "clear recovery behavior",
          "strong account authentication",
          "control over who receives access",
          "the ability to remove or update recipients",
          "understandable release rules",
          "clear deletion and privacy policies",
          "a realistic plan for keeping information current"
        ]
      },
      {
        "heading": "How AnyCircumstances is different",
        "paragraphs": [
          "AnyCircumstances combines encrypted file storage with recurring check-ins and conditional recipient delivery. Files can remain private while the user is active. If the user stops checking in and the configured grace period expires, selected recipients can be emailed secure access to the files assigned to them."
        ],
        "links": [
          {
            "label": "secure digital vault",
            "path": "/digital-vault"
          },
          {
            "label": "digital vault vs cloud storage",
            "path": "/guides/digital-vault-vs-cloud-storage"
          }
        ]
      }
    ],
    "related": [
      {
        "path": "/digital-vault",
        "label": "secure digital vault"
      },
      {
        "path": "/guides/digital-vault-vs-cloud-storage",
        "label": "Digital Vault vs Cloud Storage: What's the Difference?"
      },
      {
        "path": "/emergency-information-vault",
        "label": "emergency information vault"
      },
      {
        "path": "/security",
        "label": "Review security details"
      }
    ],
    "ctaVariant": "vault",
    "category": "Digital Vaults & Emergency Information",
    "cardTitle": "What Is a Digital Vault?",
    "cardDescription": "What secure digital vaults store, how they differ from cloud drives and password managers, and what to look for."
  },
  {
    "slug": "digital-vault-vs-cloud-storage",
    "title": "Digital Vault vs Cloud Storage: What's the Difference?",
    "seoTitle": "Digital Vault vs Cloud Storage: What's the Difference?",
    "description": "Compare secure digital vaults with Google Drive, Dropbox-style cloud storage, password managers, and emergency document storage.",
    "intro": "A digital vault and a cloud drive can both store files online, but they are built around different priorities. Cloud storage is designed for convenient everyday access and collaboration. A digital vault is designed for sensitive information, tighter access control, recovery, and deliberate sharing.",
    "published": "2026-09-08",
    "modified": "2026-09-08",
    "sections": [
      {
        "heading": "The simplest difference",
        "paragraphs": [
          "Use cloud storage when you want convenient access to files you work with regularly. Use a digital vault when the question is not just \"Where is the file?\" but also \"Who should be able to access it, under what conditions, and how should recovery work?\""
        ]
      },
      {
        "heading": "Digital vault vs cloud storage",
        "comparison": {
          "columns": [
            "Feature",
            "Digital vault",
            "Cloud storage"
          ],
          "rows": [
            [
              "Primary purpose",
              "Sensitive information and controlled access",
              "Everyday file storage and syncing"
            ],
            [
              "Typical sharing",
              "Restricted and deliberate",
              "Easy collaboration and link sharing"
            ],
            [
              "Emergency planning",
              "Often part of the design",
              "Usually not the primary purpose"
            ],
            [
              "Document organization",
              "Important records and instructions",
              "General files and folders"
            ],
            [
              "Recovery model",
              "Often more deliberate",
              "Usually account-based recovery"
            ],
            [
              "Conditional delivery",
              "Possible in specialized services",
              "Usually not built in"
            ]
          ]
        }
      },
      {
        "heading": "What belongs in ordinary cloud storage?",
        "paragraphs": [
          "Working documents, photos you actively share, collaborative files, school or business folders, and other information where convenience matters more than conditional access."
        ]
      },
      {
        "heading": "What belongs in a digital vault?",
        "paragraphs": [
          "Important records, private instructions, emergency information, account maps, property documents, insurance files, cryptocurrency recovery context, and information that should not be permanently shared with another person in advance."
        ]
      },
      {
        "heading": "Can you use both?",
        "paragraphs": [
          "Yes. A digital vault does not need to replace ordinary cloud storage. Many people use cloud storage for daily files and reserve a secure vault for sensitive records, recovery information, and documents intended for controlled access."
        ]
      },
      {
        "heading": "Where AnyCircumstances fits",
        "paragraphs": [
          "AnyCircumstances is designed for encrypted files plus recurring check-ins and trusted-recipient delivery. The important distinction is that recipients do not need permanent access to your vault. If your check-in and grace-period conditions expire, the system can email them access to the files you assigned."
        ],
        "links": [
          {
            "label": "secure digital vault",
            "path": "/digital-vault"
          },
          {
            "label": "emergency information vault",
            "path": "/emergency-information-vault"
          }
        ]
      }
    ],
    "related": [
      {
        "path": "/digital-vault",
        "label": "secure digital vault"
      },
      {
        "path": "/guides/what-is-a-digital-vault",
        "label": "What Is a Digital Vault?"
      },
      {
        "path": "/emergency-information-vault",
        "label": "emergency information vault"
      },
      {
        "path": "/security",
        "label": "Review security details"
      }
    ],
    "ctaVariant": "vault",
    "category": "Digital Vaults & Emergency Information",
    "cardTitle": "Digital Vault vs Cloud Storage",
    "cardDescription": "Compare everyday cloud drives with secure document vaults, controlled access, and emergency information storage."
  },
  {
    "slug": "digital-vault-cost",
    "title": "How Much Does a Digital Vault Cost?",
    "seoTitle": "How Much Does a Digital Vault Cost? Prices and Free Options",
    "description": "What a digital vault for important documents costs, what free options from Google and Apple cover, and when a paid vault is worth it.",
    "intro": "A safe place for documents your family may need can cost nothing, a few dollars a month, or a lawyer's fee. The difference comes down to two things: whether your files are encrypted, and whether anything happens on its own if you can't respond. This guide covers the free options first, then what paid services charge, including our own prices.",
    "published": "2026-11-12",
    "modified": "2026-11-12",
    "sections": [
      {
        "heading": "Free options you may already have",
        "cards": [
          {
            "heading": "Google Inactive Account Manager",
            "text": "If your Google account goes unused for a period you choose (3, 6, 12 or 18 months), Google can notify up to 10 people and share the Google data you picked with them. It's free. It only covers what's in your Google account, and the shortest wait is three months."
          },
          {
            "heading": "Apple Legacy Contact",
            "text": "You can name people who can request your Apple account data after you die. They need the access key you gave them and a death certificate. It's free, but it doesn't help if you're alive and unreachable."
          },
          {
            "heading": "Password manager emergency access",
            "text": "Some password managers, such as Bitwarden, let a person you trust request access to your vault after a waiting period you set. It's made for passwords more than documents, and it's often part of a paid plan, so check what yours includes."
          },
          {
            "heading": "A folder at home",
            "text": "A labeled folder or a fireproof box costs very little. Someone has to know it exists and be able to reach it, and you can't update it or send it anywhere while you're away."
          }
        ]
      },
      {
        "heading": "Options that cost money",
        "comparison": {
          "columns": [
            "Option",
            "What you pay",
            "The catch"
          ],
          "rows": [
            [
              "Safe deposit box, for original paper documents",
              "A yearly fee set by the bank",
              "After a death, family may need legal authority before the bank lets them open it"
            ],
            [
              "Estate lawyer, for wills, trusts and powers of attorney",
              "Legal fees, which vary a lot",
              "Nothing is delivered automatically, and changes go through the lawyer"
            ],
            [
              "Cloud storage, for keeping copies of files",
              "Free up to a limit, then a monthly fee",
              "Doesn't hand files to anyone if you stop responding"
            ],
            [
              "Digital vault with check-ins, for encrypted files that reach chosen people",
              "A monthly or yearly fee",
              "An ongoing cost, and you have to keep checking in"
            ]
          ]
        }
      },
      {
        "heading": "What AnyCircumstances costs",
        "paragraphs": [
          "The price depends on how much storage you need and how often you want to check in. Prices are in US dollars, and storage goes up in 5 GB steps between the amounts below.",
          "Paying yearly costs 10 times the monthly price, so two months are free. There's no free plan. Eligible Pioneer invitation codes give 30 days free, then 20% off for as long as you stay subscribed."
        ],
        "comparison": {
          "columns": [
            "What you choose",
            "Price"
          ],
          "rows": [
            [
              "5 GB of storage",
              "$4.99 a month"
            ],
            [
              "10 GB",
              "$7.99 a month"
            ],
            [
              "25 GB",
              "$12.99 a month"
            ],
            [
              "50 GB",
              "$17.99 a month"
            ],
            [
              "100 GB",
              "$22.99 a month"
            ],
            [
              "200 GB",
              "$29.99 a month"
            ],
            [
              "Monthly check-ins (every 30 days)",
              "Included"
            ],
            [
              "Weekly check-ins",
              "+$1.99 a month"
            ],
            [
              "Daily or scheduled check-ins",
              "+$2.99 a month"
            ]
          ]
        },
        "finalParagraph": "For example, 5 GB with weekly check-ins is $6.98 a month, or $69.80 a year.",
        "links": [
          {
            "label": "all plans and prices",
            "path": "/pricing"
          }
        ]
      },
      {
        "heading": "How much storage do you need?",
        "paragraphs": [
          "Probably less than you think. A scanned page saved as a PDF is usually a few hundred kilobytes, so 5 GB holds thousands of pages. You'd only need more for photos, video messages or very large scans."
        ]
      },
      {
        "heading": "When a free option is enough",
        "items": [
          "Most of what matters is already in your Google or Apple account",
          "One person should get everything, and a wait of several months is fine",
          "Your lawyer already holds your will and the documents that go with it",
          "You only need to pass on passwords, and your password manager has emergency access"
        ]
      },
      {
        "heading": "When paying for a vault makes sense",
        "items": [
          "Your information is spread across banks, devices and different services",
          "Different people should get different documents",
          "You want a shorter wait than Google's minimum of three months",
          "Your family doesn't all use the same platform, such as Apple or Google",
          "You want an emergency option you can trigger yourself while you're alive"
        ],
        "links": [
          {
            "label": "digital vault vs cloud storage",
            "path": "/guides/digital-vault-vs-cloud-storage"
          },
          {
            "label": "what a digital vault is",
            "path": "/guides/what-is-a-digital-vault"
          }
        ]
      }
    ],
    "related": [
      {
        "label": "See plans and prices",
        "path": "/pricing"
      },
      {
        "label": "What Is a Digital Vault?",
        "path": "/guides/what-is-a-digital-vault"
      },
      {
        "label": "Digital Vault vs Cloud Storage",
        "path": "/guides/digital-vault-vs-cloud-storage"
      },
      {
        "label": "How a Dead Man's Switch Email Works",
        "path": "/guides/dead-mans-switch-email"
      }
    ],
    "ctaVariant": "vault",
    "ctaAfterSection": 2,
    "category": "Digital Vaults & Emergency Information",
    "cardTitle": "How Much Does a Digital Vault Cost?",
    "cardDescription": "Free options from Google and Apple, what paid services charge, and when paying is worth it."
  }
];

export const guideBySlug = Object.fromEntries(guides.map(guide => [guide.slug, guide]));
