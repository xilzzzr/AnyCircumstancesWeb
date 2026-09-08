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
    "modified": "2026-09-08",
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
        ],
        "links": [
          {
            "label": "what happens to Bitcoin when you die",
            "path": "/guides/what-happens-to-bitcoin-when-you-die"
          }
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
        },
        "links": [
          {
            "label": "Read the Bitcoin-specific guide",
            "path": "/guides/what-happens-to-bitcoin-when-you-die"
          }
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
    "seoTitle": "Dead Man's Switch Email: How Automatic Check-Ins Work | AnyCircumstances",
    "description": "Learn how a dead man's switch email works, why check-ins and grace periods matter, and how trusted recipients can be contacted if you stop responding.",
    "intro": "A dead man's switch email is a system designed to contact someone if you stop responding. A careful system does more than schedule one message for the future. It expects you to check in, reminds you when a check-in is due, gives you extra time if you miss one, and only starts recipient delivery after the full trigger conditions are met.",
    "published": "2026-09-08",
    "modified": "2026-09-08",
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
    "seoTitle": "Proof of Life Protocol: How Digital Check-Ins Work | AnyCircumstances",
    "description": "Learn what a proof-of-life protocol is, how recurring digital check-ins work, and how missed check-ins can trigger a grace period and conditional release.",
    "intro": "A proof-of-life protocol is a process that requires a person to periodically confirm that they are still able to respond. In a digital system, that confirmation can be a recurring check-in. If the expected check-in does not happen, the system can begin a predefined escalation process.",
    "published": "2026-09-08",
    "modified": "2026-09-08",
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
    "slug": "what-happens-to-bitcoin-when-you-die",
    "title": "What Happens to Bitcoin When You Die?",
    "seoTitle": "What Happens to Bitcoin When You Die?",
    "description": "What happens to Bitcoin after death depends on self-custody, exchange custody, hardware wallets, recovery phrases, legal authority, and whether heirs can recover access.",
    "intro": "Bitcoin does not automatically transfer to another person when you die. The coins remain controlled by the same wallet credentials until somebody with the required technical access moves them. Whether an heir can actually recover the Bitcoin depends on how it was stored and what recovery information was left behind.",
    "published": "2026-09-08",
    "modified": "2026-09-08",
    "sections": [
      {
        "heading": "Bitcoin does not know its owner died",
        "paragraphs": [
          "The Bitcoin network does not contain a death registry or inheritance system. A wallet keeps working according to its keys. If the person controlling those keys dies, the network does not automatically identify an heir or move the coins."
        ],
        "links": [
          {
            "label": "cryptocurrency after death",
            "path": "/guides/what-happens-to-crypto-when-you-die"
          }
        ]
      },
      {
        "heading": "What happens to self-custodied Bitcoin?",
        "paragraphs": [
          "With self-custody, access may depend on a seed phrase, private key, hardware wallet, multisignature setup, backup device, or another recovery method. If nobody can reconstruct the required access path, the Bitcoin can remain inaccessible indefinitely."
        ]
      },
      {
        "heading": "What happens to Bitcoin held on an exchange?",
        "paragraphs": [
          "If Bitcoin is held through an exchange or custodian, the technical access problem is different. The provider may have a process for deceased customers or estates. That process can require identity documents, legal authority, account information, or other records before access is transferred."
        ]
      },
      {
        "heading": "What happens to a hardware wallet?",
        "paragraphs": [
          "Finding the hardware wallet is only part of the problem. The person handling the estate may also need to understand which wallet it is, how it was backed up, whether another PIN or passphrase exists, and where the recovery information was stored."
        ]
      },
      {
        "heading": "Should you put your Bitcoin seed phrase in a will?",
        "paragraphs": [
          "A will may become accessible to people involved in the estate process and, depending on jurisdiction and procedure, may not remain private forever. Putting a raw seed phrase directly into an ordinary document can create serious security risk. Consider separating legal instructions from sensitive technical recovery information and discuss estate-specific decisions with an appropriate professional."
        ]
      },
      {
        "heading": "What information should your family know?",
        "items": [
          "that Bitcoin exists",
          "whether it is self-custodied or held through an exchange",
          "which devices or hardware wallets matter",
          "where authoritative recovery instructions are located",
          "which professional or trusted person should be contacted",
          "whether multisignature or another advanced setup is involved",
          "what not to do before understanding the recovery process"
        ]
      },
      {
        "heading": "Bitcoin and Ethereum are similar in one important way",
        "paragraphs": [
          "Neither network automatically transfers assets because the owner died. Ethereum can add extra complexity because one wallet may control ETH, tokens, stablecoins, NFTs, or DeFi positions. In both cases, heirs need a plan that connects legal authority with technical recovery."
        ]
      },
      {
        "heading": "How AnyCircumstances can fit into a Bitcoin recovery plan",
        "paragraphs": [
          "AnyCircumstances can be used to prepare encrypted files explaining wallet locations, devices, exchange accounts, recovery procedures, and trusted contacts. The system can conditionally deliver those files if the owner's check-in and grace-period rules expire. It does not transfer ownership of Bitcoin and does not act as a cryptocurrency custodian."
        ],
        "links": [
          {
            "label": "secure digital vault",
            "path": "/digital-vault"
          },
          {
            "label": "dead man's switch",
            "path": "/dead-mans-switch"
          }
        ]
      }
    ],
    "related": [
      {
        "path": "/guides/what-happens-to-crypto-when-you-die",
        "label": "What Happens to Cryptocurrency When You Die?"
      },
      {
        "path": "/dead-mans-switch",
        "label": "dead man's switch"
      },
      {
        "path": "/digital-vault",
        "label": "secure digital vault"
      },
      {
        "path": "/security",
        "label": "Review security details"
      }
    ],
    "ctaVariant": "crypto",
    "category": "Crypto & Digital Assets",
    "cardTitle": "What Happens to Bitcoin When You Die?",
    "cardDescription": "How self-custody, exchanges, hardware wallets, recovery information, and estate planning affect Bitcoin access after death."
  }
];

export const guideBySlug = Object.fromEntries(guides.map(guide => [guide.slug, guide]));
