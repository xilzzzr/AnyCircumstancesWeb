export const ctaVariants = {
  "general": {
    "eyebrow": "READY TO PUT A PLAN IN PLACE?",
    "heading": "Protect the files someone may need if you become unavailable.",
    "body": "Encrypt important files, choose trusted recipients, and set the check-in rules that control when your files can be released.",
    "primary": "Create Your Vault",
    "secondary": "See How It Works",
    "primaryPath": "/signup",
    "secondaryPath": "/how-it-works"
  },
  "switch": {
    "eyebrow": "BUILD YOUR OWN CHECK-IN PLAN",
    "heading": "Set up a dead man's switch around your real schedule.",
    "body": "Choose your check-in frequency, email reminders, grace period, and trusted recipients. If you stop checking in and the grace period expires, AnyCircumstances follows the release rules you configured.",
    "primary": "Set Up Your Switch",
    "secondary": "See the Check-In Flow",
    "primaryPath": "/signup",
    "secondaryPath": "/how-it-works"
  },
  "vault": {
    "eyebrow": "CREATE A PRIVATE DOCUMENT VAULT",
    "heading": "Keep important documents encrypted until the right person actually needs them.",
    "body": "Store encrypted files, assign trusted recipients, and control when access can be released instead of sharing everything in advance.",
    "primary": "Create Your Vault",
    "secondary": "See How Delivery Works",
    "primaryPath": "/signup",
    "secondaryPath": "/how-it-works"
  },
  "crypto": {
    "eyebrow": "PLAN THE RECOVERY PATH",
    "heading": "Make sure your crypto does not become inaccessible because nobody knows what to do next.",
    "body": "Prepare encrypted instructions about wallets, devices, accounts, recovery steps, and trusted contacts, then control when those instructions can be released.",
    "primary": "Protect Important Information",
    "secondary": "How the Release System Works",
    "primaryPath": "/signup",
    "secondaryPath": "/how-it-works"
  },
  "emergency": {
    "eyebrow": "TURN INFORMATION INTO A PLAN",
    "heading": "Make sure the right information can reach the right people.",
    "body": "Organize important files, choose who should receive them, and use check-ins and a grace period to control when access can be released.",
    "primary": "Create Your Emergency Vault",
    "secondary": "See How It Works",
    "primaryPath": "/signup",
    "secondaryPath": "/how-it-works"
  },
  "informational": {
    "heading": "Want to see how AnyCircumstances works?",
    "body": "See how encrypted storage, recurring check-ins, grace periods, and trusted-recipient delivery fit together.",
    "primary": "See How It Works",
    "secondary": "Explore the Digital Vault",
    "primaryPath": "/how-it-works",
    "secondaryPath": "/digital-vault"
  }
} as const;
export type CtaVariant = keyof typeof ctaVariants;
