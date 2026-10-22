import { b64FromBytes, bytesFromB64 } from "./vaultCrypto";

export const DOCUMENT_TYPE = "application/vnd.anycircumstances.document+json";
export const MAX_DOCUMENT_BYTES = 128 * 1024;
export const MAX_NOTE_LENGTH = 4000;
export const templates = [
  {
    id: "passwords",
    title: "Passwords & accounts",
    description: "Save passwords, usernames, and sign-in instructions.",
  },
  {
    id: "wallet",
    title: "Crypto wallet & seed phrase",
    description:
      "Leave recovery words and the details needed to find the correct wallet.",
  },
  {
    id: "instructions",
    title: "Important instructions",
    description: "Explain what someone should do or where to find things.",
  },
  {
    id: "message",
    title: "A message for someone",
    description: "Write a personal letter to someone you trust.",
  },
  {
    id: "contacts",
    title: "Important contacts",
    description: "List people your recipient may need to contact.",
  },
  {
    id: "blank",
    title: "Blank document",
    description: "Write anything you want.",
  },
  {
    id: "introduction",
    title: "Package introduction",
    description:
      "Leave an overall message explaining where to start. Assign it to each person who should see it.",
  },
] as const;
export type TemplateId = (typeof templates)[number]["id"];
export type Account = {
  name: string;
  website: string;
  username: string;
  password: string;
  notes: string;
  verification: string;
};
export type Contact = {
  name: string;
  role: string;
  phone: string;
  email: string;
  notes: string;
};
export const backupFormats = [
  "unknown",
  "bip39",
  "slip39",
  "electrum",
  "other",
] as const;
export const passphraseStatuses = [
  "unknown",
  "none",
  "included",
  "separate",
] as const;
export type WalletRecovery = {
  walletApp: string;
  networks: string;
  backupFormat: (typeof backupFormats)[number];
  phraseLanguage: string;
  phrases: string[];
  passphraseStatus: (typeof passphraseStatuses)[number];
  passphrase: string;
  passphraseLocation: string;
  derivationPaths: string;
  accountIndexes: string;
  addressType: string;
  expectedAddresses: string;
  walletPassword: string;
  deviceAccess: string;
  configuration: string;
  instructions: string;
};
export const emptyWallet = (): WalletRecovery => ({
  walletApp: "",
  networks: "",
  backupFormat: "unknown",
  phraseLanguage: "",
  phrases: [""],
  passphraseStatus: "unknown",
  passphrase: "",
  passphraseLocation: "",
  derivationPaths: "",
  accountIndexes: "",
  addressType: "",
  expectedAddresses: "",
  walletPassword: "",
  deviceAccess: "",
  configuration: "",
  instructions: "",
});
export const phraseWords = (phrase: string) =>
  phrase.trim().split(/\s+/u).filter(Boolean);
function validWallet(wallet: WalletRecovery) {
  const sample = emptyWallet();
  return (
    wallet &&
    typeof wallet === "object" &&
    Object.keys(sample)
      .filter((k) => k !== "phrases")
      .every(
        (k) =>
          typeof wallet[k as keyof WalletRecovery] === "string" &&
          (wallet[k as keyof WalletRecovery] as string).length <= 8000,
      ) &&
    backupFormats.includes(wallet.backupFormat) &&
    passphraseStatuses.includes(wallet.passphraseStatus) &&
    Array.isArray(wallet.phrases) &&
    wallet.phrases.length >= 1 &&
    wallet.phrases.length <= 16 &&
    wallet.phrases.every((p) => typeof p === "string" && p.length <= 4000)
  );
}
export function validateWallet(wallet: WalletRecovery | undefined) {
  if (!wallet || !validWallet(wallet))
    throw new Error("Unsupported or damaged wallet details.");
  if (!wallet.walletApp.trim() || !wallet.networks.trim())
    throw new Error("Enter the wallet app or device and its networks.");
  if (wallet.phrases.some((p) => !p.trim()))
    throw new Error("Enter each recovery phrase in its original word order.");
  if (
    wallet.backupFormat !== "slip39" &&
    wallet.backupFormat !== "other" &&
    wallet.phrases.length !== 1
  )
    throw new Error("Use a separate document for each wallet backup.");
  const lengths =
    wallet.backupFormat === "bip39"
      ? [12, 15, 18, 21, 24]
      : wallet.backupFormat === "slip39"
        ? [20, 33]
        : null;
  if (
    lengths &&
    wallet.phrases.some((p) => !lengths.includes(phraseWords(p).length))
  )
    throw new Error(
      wallet.backupFormat === "bip39"
        ? "BIP39 phrases contain 12, 15, 18, 21, or 24 words. Check the format and word count."
        : "SLIP39 shares contain 20 or 33 words. Check the format and word count.",
    );
  if (wallet.passphraseStatus === "included" && !wallet.passphrase.length)
    throw new Error(
      "Enter the exact wallet passphrase, or choose where it is kept separately.",
    );
  if (
    wallet.passphraseStatus === "separate" &&
    !wallet.passphraseLocation.trim()
  )
    throw new Error(
      "Explain where the recipient can find the wallet passphrase.",
    );
  if (wallet.passphraseStatus !== "included" && wallet.passphrase !== "")
    throw new Error("Remove the wallet passphrase or choose to include it.");
  if (
    wallet.passphraseStatus !== "separate" &&
    wallet.passphraseLocation !== ""
  )
    throw new Error(
      "Remove the passphrase location or choose to keep it separately.",
    );
}
export type VaultDocument = {
  version: 1;
  template: TemplateId;
  title: string;
  body: string;
  location: string;
  help: string;
  accounts: Account[];
  contacts: Contact[];
  updatedAt: string;
  wallet?: WalletRecovery;
};
export type SealedNote = { version: 1; iv_b64: string; ciphertext_b64: string };
export type FileMeta = {
  original_name?: string;
  original_content_type?: string;
  original_size_bytes?: number;
  iv_b64?: string;
  recipient_note?: SealedNote;
  document_template?: TemplateId;
  content_revision?: string;
  [key: string]: unknown;
};
export const emptyAccount = (): Account => ({
  name: "",
  website: "",
  username: "",
  password: "",
  notes: "",
  verification: "",
});
export const emptyContact = (): Contact => ({
  name: "",
  role: "",
  phone: "",
  email: "",
  notes: "",
});
export function newDocument(template: TemplateId): VaultDocument {
  return {
    version: 1,
    template,
    title: template === "introduction" ? "Start here" : "",
    body: "",
    location: "",
    help: "",
    accounts: [emptyAccount()],
    contacts: [emptyContact()],
    updatedAt: new Date().toISOString(),
    ...(template === "wallet" ? { wallet: emptyWallet() } : {}),
  };
}
export function validateDocument(doc: VaultDocument) {
  if (!doc.title.trim()) throw new Error("Please give your document a title.");
  if (doc.title.length > 150)
    throw new Error("Use a title of 150 characters or fewer.");
  if (doc.template === "passwords" && doc.accounts.some((a) => !a.name.trim()))
    throw new Error("Give each account a name.");
  if (doc.template === "contacts" && doc.contacts.some((c) => !c.name.trim()))
    throw new Error("Give each contact a name.");
  if (doc.template === "wallet") validateWallet(doc.wallet);
  if (
    !["passwords", "contacts", "wallet"].includes(doc.template) &&
    !doc.body.trim()
  )
    throw new Error("Write something in your document before saving.");
  if (new TextEncoder().encode(JSON.stringify(doc)).length > MAX_DOCUMENT_BYTES)
    throw new Error(
      "This document is too large. Please split it into smaller documents.",
    );
}
export function parseDocument(text: string): VaultDocument {
  if (new TextEncoder().encode(text).length > MAX_DOCUMENT_BYTES)
    throw new Error("This document is too large.");
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new Error("Unsupported or damaged document.");
  }
  if (
    doc?.version !== 1 ||
    !templates.some((t) => t.id === doc.template) ||
    typeof doc.title !== "string" ||
    !["body", "location", "help", "updatedAt"].every(
      (k) => typeof doc[k] === "string",
    ) ||
    !Array.isArray(doc.accounts) ||
    !Array.isArray(doc.contacts) ||
    doc.accounts.length > 100 ||
    doc.contacts.length > 100 ||
    !doc.accounts.every(
      (a) =>
        a &&
        [
          "name",
          "website",
          "username",
          "password",
          "notes",
          "verification",
        ].every((k) => typeof a[k] === "string"),
    ) ||
    !doc.contacts.every(
      (c) =>
        c &&
        ["name", "role", "phone", "email", "notes"].every(
          (k) => typeof c[k] === "string",
        ),
    )
  )
    throw new Error("Unsupported or damaged document.");
  validateDocument(doc);
  return doc;
}
export function documentText(doc: VaultDocument): string {
  const lines = [doc.title, `Last updated: ${doc.updatedAt.slice(0, 10)}`, ""];
  if (doc.template === "passwords")
    for (const a of doc.accounts) {
      lines.push(
        a.name,
        ...[
          ["Website or app", a.website],
          ["Username or email", a.username],
          ["Password", a.password],
          ["Additional sign-in steps", a.verification],
          ["Instructions", a.notes],
        ]
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}: ${v}`),
        "",
      );
    }
  else if (doc.template === "wallet") {
    validateWallet(doc.wallet);
    const w = doc.wallet!;
    lines.push(
      "Sensitive wallet recovery information",
      "Anyone with the recovery words and any required passphrase may control the funds.",
      "",
    );
    for (const [label, value] of [
      ["Wallet app / hardware device and version", w.walletApp],
      ["Networks and assets", w.networks],
      ["Backup format", w.backupFormat],
      ["Recovery word language", w.phraseLanguage],
    ])
      if (value) lines.push(`${label}: ${value}`);
    w.phrases.forEach((phrase, i) =>
      lines.push(
        "",
        w.phrases.length > 1
          ? `Recovery share ${i + 1} (words in order)`
          : "Recovery phrase (words in order)",
        ...phraseWords(phrase).map((word, j) => `${j + 1}. ${word}`),
      ),
    );
    const status = {
      unknown:
        "Not confirmed. Check the owner's recovery instructions before attempting recovery.",
      none: "Owner states no additional wallet passphrase is used.",
      included:
        "Included below. Preserve every character, space, and capital letter.",
      separate: "Kept separately. See the location below.",
    }[w.passphraseStatus];
    lines.push("", `Wallet passphrase status: ${status}`);
    for (const [label, value] of [
      [
        "Exact wallet passphrase (between the START and END lines)",
        w.passphraseStatus === "included"
          ? `\nSTART PASSPHRASE\n${w.passphrase}\nEND PASSPHRASE`
          : "",
      ],
      ["Where to find the wallet passphrase", w.passphraseLocation],
      ["Derivation paths", w.derivationPaths],
      ["Account numbers and address indexes", w.accountIndexes],
      ["Address / script type", w.addressType],
      ["Known receiving addresses to verify recovery", w.expectedAddresses],
      ["Local wallet or backup-file password", w.walletPassword],
      ["Original device access and PIN instructions", w.deviceAccess],
      ["Multi-share / multisig configuration", w.configuration],
      ["Recovery steps and other requirements", w.instructions],
    ])
      if (value) lines.push("", `${label}: ${value}`);
    lines.push(
      "",
      "This document records the owner's information. It does not verify the recovery words, checksum, account balance, or that all recovery requirements are present. Recover only through the genuine wallet app or hardware device; never enter words into a link sent by someone else.",
    );
  } else if (doc.template === "contacts")
    for (const c of doc.contacts) {
      lines.push(
        c.name,
        ...[
          ["Relationship or role", c.role],
          ["Phone", c.phone],
          ["Email", c.email],
          ["Notes", c.notes],
        ]
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}: ${v}`),
        "",
      );
    }
  else
    lines.push(
      doc.body,
      ...(doc.location ? ["\nWhere to find things", doc.location] : []),
      ...(doc.help ? ["\nWho can help", doc.help] : []),
    );
  return lines.join("\n");
}
export function safeDownloadName(title: string) {
  return (
    Array.from(title.normalize("NFC"), (char) =>
      char.charCodeAt(0) < 32 || '/\\:*?"<>|'.includes(char) ? "_" : char,
    )
      .join("")
      .trim()
      .slice(0, 150)
      .replace(/^\.+$/, "") || "Document"
  );
}
export function documentFile(doc: VaultDocument) {
  validateDocument(doc);
  return new File([JSON.stringify(doc)], `${safeDownloadName(doc.title)}.pdf`, {
    type: DOCUMENT_TYPE,
  });
}
// Notes use a separate random nonce and a domain-bound AAD. Plaintext never enters envelope metadata.
export async function sealRecipientNote(
  note: string,
  rawKey: Uint8Array,
): Promise<SealedNote | undefined> {
  if (!note.trim()) return undefined;
  if (note.length > MAX_NOTE_LENGTH)
    throw new Error("Recipient notes can contain up to 4,000 characters.");
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, [
    "encrypt",
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: new TextEncoder().encode("uac:recipient-note:v1"),
    },
    key,
    new TextEncoder().encode(note),
  );
  return {
    version: 1,
    iv_b64: b64FromBytes(iv),
    ciphertext_b64: b64FromBytes(new Uint8Array(encrypted)),
  };
}
export async function openRecipientNote(
  note: SealedNote | undefined,
  rawKey: Uint8Array,
) {
  if (!note) return "";
  if (note.version !== 1) throw new Error("Unsupported recipient note.");
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, [
    "decrypt",
  ]);
  const bytes = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: bytesFromB64(note.iv_b64),
      additionalData: new TextEncoder().encode("uac:recipient-note:v1"),
    },
    key,
    bytesFromB64(note.ciphertext_b64),
  );
  const text = new TextDecoder().decode(bytes);
  if (text.length > MAX_NOTE_LENGTH)
    throw new Error("Recipient note is too large.");
  return text;
}
