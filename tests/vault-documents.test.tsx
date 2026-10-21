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
} from "../src/lib/vaultDocuments";
import { encryptFileToAesGcm } from "../src/lib/vaultCrypto";
import { decryptUacBytes } from "../src/lib/uacChunk";

describe("native vault documents", () => {
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
