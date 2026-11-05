import { describe, it, expect, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { File as NodeFile, Blob as NodeBlob } from "node:buffer";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { VaultDocumentEditor } from "../src/components/app/VaultDocumentEditor";
import {
  sealRecipientNote,
  openRecipientNote,
  newDocument,
  parseDocument,
  documentText,
  documentFile,
  validateDocument,
  phraseWords,
} from "../src/lib/vaultDocuments";
import { encryptFileToAesGcm } from "../src/lib/vaultCrypto";
import { decryptUacBytes } from "../src/lib/uacChunk";

describe("native vault documents", () => {
  it("records wallet recovery requirements with masked secrets and no browser persistence", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const persist = vi.spyOn(Storage.prototype, "setItem");
    render(
      <MemoryRouter>
        <VaultDocumentEditor onSave={save} onCancel={() => {}} />
      </MemoryRouter>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Crypto wallet & seed phrase/ }),
    );
    fireEvent.change(screen.getByLabelText("Document title"), {
      target: { value: "Family wallet" },
    });
    fireEvent.change(screen.getByLabelText("Wallet app or hardware device"), {
      target: { value: "Example hardware wallet" },
    });
    fireEvent.change(screen.getByLabelText("Networks and assets"), {
      target: { value: "Bitcoin mainnet" },
    });
    fireEvent.change(screen.getByLabelText("Backup format"), {
      target: { value: "bip39" },
    });
    const phrase = screen.getByLabelText("Recovery phrase") as HTMLInputElement;
    const words = Array.from({ length: 12 }, (_, i) => `example${i + 1}`).join(
      " ",
    );
    fireEvent.change(phrase, { target: { value: words } });
    expect(phrase.type).toBe("password");
    expect(phrase.autocomplete).toBe("off");
    expect(phrase.getAttribute("spellcheck")).toBe("false");
    fireEvent.click(
      screen.getByRole("button", { name: "Show recovery phrase" }),
    );
    expect(phrase.type).toBe("text");
    fireEvent(window, new Event("blur"));
    expect(phrase.type).toBe("password");
    fireEvent.change(
      screen.getByLabelText(
        "Does this wallet use an additional recovery passphrase?",
      ),
      { target: { value: "included" } },
    );
    fireEvent.change(
      screen.getByLabelText("Exact wallet recovery passphrase"),
      { target: { value: "  Case Sensitive  " } },
    );
    fireEvent.change(screen.getByLabelText("Derivation paths (if known)"), {
      target: { value: "m/84'/0'/2'" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save to vault" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    const doc = save.mock.calls[0][0];
    expect(doc.wallet.passphrase).toBe("  Case Sensitive  ");
    expect(doc.wallet.phrases).toEqual([words]);
    expect(documentText(doc)).toContain("1. example1\n2. example2");
    expect(documentText(doc)).toContain("m/84'/0'/2'");
    expect(persist).not.toHaveBeenCalled();
  });
  it("validates backup formats and requirements, preserves exact secrets, and exports all recovery details", async () => {
    vi.stubGlobal("crypto", webcrypto);
    vi.stubGlobal("File", NodeFile);
    vi.stubGlobal("Blob", NodeBlob);
    const doc = newDocument("wallet");
    doc.title = "Recovery instructions";
    const wallet = doc.wallet!;
    wallet.walletApp = "Example Wallet";
    wallet.networks = "Bitcoin mainnet; Ethereum mainnet";
    wallet.backupFormat = "bip39";
    wallet.phrases = [
      Array.from({ length: 12 }, (_, i) => `word${i}`).join(" "),
    ];
    wallet.passphraseStatus = "included";
    wallet.passphrase = "  ПАРОЛЬ with spaces  ";
    wallet.derivationPaths = "m/84'/0'/0'";
    wallet.accountIndexes = "Account 0, receiving index 10";
    wallet.addressType = "Native SegWit";
    wallet.expectedAddresses = "Verify address in offline wallet";
    wallet.configuration = "2 of 3 signers, descriptor in separate backup";
    wallet.walletPassword = "Local file password";
    wallet.deviceAccess = "Original device access";
    wallet.instructions = "Do not open links from strangers";
    const parsed = parseDocument(JSON.stringify(doc));
    expect(parsed).toEqual(doc);
    const exported = documentText(parsed);
    for (const value of [
      wallet.passphrase,
      wallet.derivationPaths,
      wallet.accountIndexes,
      wallet.addressType,
      wallet.expectedAddresses,
      wallet.configuration,
      wallet.walletPassword,
      wallet.deviceAccess,
      wallet.instructions,
    ])
      expect(exported).toContain(value);
    const encrypted = await encryptFileToAesGcm(documentFile(doc));
    const cipher = new Uint8Array(await encrypted.blob.arrayBuffer());
    expect(new TextDecoder().decode(cipher)).not.toContain(wallet.phrases[0]);
    const aes = await webcrypto.subtle.importKey(
      "raw",
      encrypted.rawAes,
      "AES-GCM",
      false,
      ["decrypt"],
    );
    expect(
      parseDocument(
        new TextDecoder().decode(
          await decryptUacBytes(aes, cipher, encrypted.meta),
        ),
      ),
    ).toEqual(doc);
    const damaged = cipher.slice();
    damaged[damaged.length - 1] ^= 1;
    await expect(
      decryptUacBytes(aes, damaged, encrypted.meta),
    ).rejects.toThrow();
    const wrongKey = await webcrypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"],
    );
    await expect(
      decryptUacBytes(wrongKey, cipher, encrypted.meta),
    ).rejects.toThrow();
    wallet.phrases = ["too short"];
    expect(() => validateDocument(doc)).toThrow(/BIP39/);
    wallet.backupFormat = "slip39";
    wallet.phrases = ["one ".repeat(20), "two ".repeat(33)];
    expect(() => validateDocument(doc)).not.toThrow();
    wallet.phrases.push("short");
    expect(() => validateDocument(doc)).toThrow(/SLIP39/);
    wallet.phrases = ["one ".repeat(20)];
    wallet.passphraseStatus = "separate";
    wallet.passphrase = "";
    expect(() => validateDocument(doc)).toThrow(/where/);
    wallet.passphraseLocation = "Offline safe";
    expect(() => validateDocument(doc)).not.toThrow();
    expect(phraseWords(" first\nsecond\tthird ")).toEqual([
      "first",
      "second",
      "third",
    ]);
    expect(() => parseDocument('{"secret":"never-report-this"')).toThrow(
      "Unsupported or damaged document.",
    );
    expect(() =>
      parseDocument(
        JSON.stringify({ ...doc, wallet: { ...wallet, phrases: [17] } }),
      ),
    ).toThrow(/damaged/);
  });
  it("offers the templates and saves a password document with its recipient note", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <VaultDocumentEditor onSave={save} onCancel={() => {}} />
      </MemoryRouter>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Passwords & accounts/ }),
    );
    fireEvent.change(screen.getByLabelText("Document title"), {
      target: { value: "Household accounts" },
    });
    fireEvent.change(screen.getByLabelText("Account name"), {
      target: { value: "Home Wi-Fi" },
    });
    const password = screen.getByLabelText(
      "Password (optional)",
    ) as HTMLInputElement;
    expect(password.type).toBe("password");
    fireEvent.change(password, { target: { value: "keep-this-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password.type).toBe("text");
    fireEvent.change(
      screen.getByLabelText("Note for your recipient (optional)"),
      { target: { value: "The router is in the hallway." } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Save to vault" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][0].accounts[0].password).toBe("keep-this-secret");
    expect(save.mock.calls[0][1]).toBe("The router is in the hallway.");
    expect(screen.getByText(/Saving does not send anything/)).toBeTruthy();
  });
  it("encrypts notes, preserves Unicode, and rejects tampering and the wrong file key", async () => {
    vi.stubGlobal("crypto", webcrypto);
    const key = webcrypto.getRandomValues(new Uint8Array(32));
    const note = "Анна, начни с почты. <script>alert(1)</script>";
    const sealed = await sealRecipientNote(note, key);
    expect(JSON.stringify(sealed)).not.toContain("Анна");
    expect(await openRecipientNote(sealed, key)).toBe(note);
    await expect(
      openRecipientNote(sealed, webcrypto.getRandomValues(new Uint8Array(32))),
    ).rejects.toThrow();
    await expect(
      openRecipientNote({ ...sealed!, iv_b64: btoa("tamperediv12") }, key),
    ).rejects.toThrow();
    expect(await sealRecipientNote("", key)).toBeUndefined();
    await expect(sealRecipientNote("x".repeat(4001), key)).rejects.toThrow();
  });
  it("keeps edited documents decryptable with the existing file key and independent random nonces", async () => {
    vi.stubGlobal("crypto", webcrypto);
    vi.stubGlobal("File", NodeFile);
    vi.stubGlobal("Blob", NodeBlob);
    const doc = newDocument("passwords");
    doc.title = "Accounts";
    doc.accounts[0].name = "Email";
    doc.accounts[0].password = "first";
    const first = await encryptFileToAesGcm(documentFile(doc));
    doc.accounts[0].password = "second";
    const second = await encryptFileToAesGcm(documentFile(doc), first.rawAes);
    expect(second.rawAes).toEqual(first.rawAes);
    const aes = await webcrypto.subtle.importKey(
      "raw",
      first.rawAes,
      "AES-GCM",
      false,
      ["decrypt"],
    );
    const oldText = new TextDecoder().decode(
      await decryptUacBytes(
        aes,
        new Uint8Array(await first.blob.arrayBuffer()),
        first.meta,
      ),
    );
    const newText = new TextDecoder().decode(
      await decryptUacBytes(
        aes,
        new Uint8Array(await second.blob.arrayBuffer()),
        second.meta,
      ),
    );
    expect(parseDocument(oldText).accounts[0].password).toBe("first");
    expect(parseDocument(newText).accounts[0].password).toBe("second");
    expect(documentText(parseDocument(newText))).toContain("Password: second");
  });
  it("rejects empty, malformed, and oversized documents", () => {
    expect(() => validateDocument(newDocument("blank"))).toThrow();
    expect(() => parseDocument('{"version":1}')).toThrow();
    const doc = newDocument("blank");
    doc.title = "Notes";
    doc.body = "x".repeat(140000);
    expect(() => validateDocument(doc)).toThrow(/too large/);
  });
});
