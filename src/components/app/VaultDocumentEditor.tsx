import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import {
  templates,
  newDocument,
  emptyAccount,
  emptyContact,
  validateDocument,
  MAX_NOTE_LENGTH,
  type VaultDocument,
} from "@/lib/vaultDocuments";

export function RecipientNoteField({
  value,
  onChange,
  disabled = false,
  id = "recipient-note",
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Note for your recipient (optional)</Label>
      <p id={`${id}-help`} className="text-sm text-muted-foreground">
        Explain what this file contains or how to use it. Everyone assigned this
        file will see the same note when it is released.
      </p>
      <Textarea
        id={id}
        aria-describedby={`${id}-help`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={MAX_NOTE_LENGTH}
        disabled={disabled}
        rows={4}
      />
      <p className="text-xs text-muted-foreground">
        {value.length.toLocaleString()} / 4,000 characters
      </p>
    </div>
  );
}

export function VaultDocumentEditor({
  initial,
  initialNote = "",
  onSave,
  onCancel,
  busy = false,
}: {
  initial?: VaultDocument;
  initialNote?: string;
  onSave: (doc: VaultDocument, note: string) => Promise<void>;
  onCancel: () => void;
  busy?: boolean;
}) {
  const [doc, setDoc] = useState<VaultDocument | null>(initial || null);
  const [note, setNote] = useState(initialNote);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState<Record<number, boolean>>({});
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    // Guard same-origin app links as well as full-page navigation.
    const navigate = (event: MouseEvent) => {
      if (
        !dirty ||
        !(event.target instanceof Element) ||
        !event.target.closest("a[href]")
      )
        return;
      if (!window.confirm("You have unsaved changes. Leave without saving?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty]);
  const change = (patch: Partial<VaultDocument>) => {
    setDoc((d) => (d ? { ...d, ...patch } : d));
    setDirty(true);
  };
  const cancel = () => {
    if (!busy && (!dirty || window.confirm("Discard your unsaved changes?")))
      onCancel();
  };
  if (!doc)
    return (
      <section className="space-y-4" aria-label="Choose a template">
        <h2 className="text-xl font-semibold">What would you like to write?</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setDoc(newDocument(t.id));
                setError("");
              }}
              className="rounded-xl border bg-card p-5 text-left hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="block font-semibold">{t.title}</span>
              <span className="block text-sm text-muted-foreground mt-2">
                {t.description}
              </span>
            </button>
          ))}
        </div>
        <Button variant="outline" onClick={cancel}>
          Cancel
        </Button>
      </section>
    );
  const textField = (
    field: "title" | "body" | "location" | "help",
    label: string,
    multiline = false,
  ) => (
    <div className="space-y-2">
      <Label htmlFor={`document-${field}`}>{label}</Label>
      {multiline ? (
        <Textarea
          id={`document-${field}`}
          value={doc[field]}
          onChange={(e) => change({ [field]: e.target.value })}
          rows={field === "body" ? 10 : 3}
          maxLength={60000}
        />
      ) : (
        <Input
          id={`document-${field}`}
          value={doc[field]}
          onChange={(e) => change({ [field]: e.target.value })}
          maxLength={150}
          required
        />
      )}
    </div>
  );
  return (
    <form
      className="space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setError("");
        try {
          const next = {
            ...doc,
            title: doc.title.trim(),
            updatedAt: new Date().toISOString(),
          };
          validateDocument(next);
          await onSave(next, note);
          setDirty(false);
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not save. Your changes are still here.",
          );
        }
      }}
    >
      {!initial && (
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            if (
              !dirty ||
              window.confirm("Discard changes and choose another template?")
            ) {
              setDoc(null);
              setDirty(false);
            }
          }}
        >
          Back to templates
        </Button>
      )}
      <h2 className="text-xl font-semibold">
        {templates.find((t) => t.id === doc.template)?.title}
      </h2>
      <fieldset disabled={busy} className="space-y-6">
        {textField("title", "Document title")}
        {doc.template === "passwords" ? (
          <div className="space-y-4">
            {doc.accounts.map((account, index) => (
              <section
                key={index}
                className="rounded-xl border p-4 space-y-4"
                aria-label={`Account ${index + 1}`}
              >
                <h3 className="font-semibold">Account {index + 1}</h3>
                {(
                  ["name", "website", "username", "password", "notes"] as const
                ).map((field) => {
                  const label = {
                    name: "Account name",
                    website: "Website or app (optional)",
                    username: "Username or email (optional)",
                    password: "Password (optional)",
                    notes: "Anything else they should know? (optional)",
                  }[field];
                  const id = `account-${index}-${field}`;
                  const update = (value: string) =>
                    change({
                      accounts: doc.accounts.map((a, i) =>
                        i === index ? { ...a, [field]: value } : a,
                      ),
                    });
                  return (
                    <div key={field} className="space-y-2">
                      <Label htmlFor={id}>{label}</Label>
                      {field === "notes" ? (
                        <Textarea
                          id={id}
                          value={account[field]}
                          onChange={(e) => update(e.target.value)}
                          maxLength={4000}
                        />
                      ) : (
                        <Input
                          id={id}
                          type={
                            field === "password" && !visible[index]
                              ? "password"
                              : "text"
                          }
                          value={account[field]}
                          onChange={(e) => update(e.target.value)}
                          autoComplete="off"
                          autoCapitalize="none"
                          spellCheck={false}
                          required={field === "name"}
                          maxLength={2000}
                        />
                      )}
                      {field === "name" && (
                        <p className="text-sm text-muted-foreground">
                          For example: Gmail, electric company, or home Wi-Fi.
                        </p>
                      )}
                      {field === "password" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setVisible((v) => ({ ...v, [index]: !v[index] }))
                          }
                        >
                          {visible[index] ? "Hide password" : "Show password"}
                        </Button>
                      )}
                    </div>
                  );
                })}
                <details>
                  <summary className="cursor-pointer text-sm font-medium">
                    Does this account need a verification code or another
                    sign-in step?
                  </summary>
                  <Label
                    htmlFor={`verification-${index}`}
                    className="block mt-3 mb-2"
                  >
                    Explain how to sign in and where to find what is needed
                  </Label>
                  <Textarea
                    id={`verification-${index}`}
                    value={account.verification}
                    onChange={(e) =>
                      change({
                        accounts: doc.accounts.map((a, i) =>
                          i === index
                            ? { ...a, verification: e.target.value }
                            : a,
                        ),
                      })
                    }
                    maxLength={4000}
                  />
                </details>
                {doc.accounts.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (
                        window.confirm("Remove this account from the document?")
                      )
                        change({
                          accounts: doc.accounts.filter((_, i) => i !== index),
                        });
                    }}
                  >
                    Remove account {index + 1}
                  </Button>
                )}
              </section>
            ))}
            <Button
              type="button"
              variant="outline"
              disabled={doc.accounts.length >= 100}
              onClick={() =>
                change({ accounts: [...doc.accounts, emptyAccount()] })
              }
            >
              Add another account
            </Button>
          </div>
        ) : doc.template === "contacts" ? (
          <div className="space-y-4">
            {doc.contacts.map((contact, index) => (
              <section
                key={index}
                className="rounded-xl border p-4 space-y-4"
                aria-label={`Contact ${index + 1}`}
              >
                <h3 className="font-semibold">Contact {index + 1}</h3>
                {(["name", "role", "phone", "email", "notes"] as const).map(
                  (field) => (
                    <div key={field} className="space-y-2">
                      <Label htmlFor={`contact-${index}-${field}`}>
                        {
                          {
                            name: "Name",
                            role: "Relationship or role (optional)",
                            phone: "Phone (optional)",
                            email: "Email (optional)",
                            notes: "What can they help with? (optional)",
                          }[field]
                        }
                      </Label>
                      <Input
                        id={`contact-${index}-${field}`}
                        value={contact[field]}
                        onChange={(e) =>
                          change({
                            contacts: doc.contacts.map((c, i) =>
                              i === index
                                ? { ...c, [field]: e.target.value }
                                : c,
                            ),
                          })
                        }
                        required={field === "name"}
                        maxLength={2000}
                      />
                    </div>
                  ),
                )}
                {doc.contacts.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (
                        window.confirm("Remove this contact from the document?")
                      )
                        change({
                          contacts: doc.contacts.filter((_, i) => i !== index),
                        });
                    }}
                  >
                    Remove contact {index + 1}
                  </Button>
                )}
              </section>
            ))}
            <Button
              type="button"
              variant="outline"
              disabled={doc.contacts.length >= 100}
              onClick={() =>
                change({ contacts: [...doc.contacts, emptyContact()] })
              }
            >
              Add another contact
            </Button>
          </div>
        ) : (
          <>
            {textField(
              "body",
              doc.template === "instructions"
                ? "What should someone know or do?"
                : doc.template === "introduction"
                  ? "Where should your recipient start?"
                  : "Your message",
              true,
            )}
            {doc.template === "instructions" && (
              <>
                {textField(
                  "location",
                  "Where can they find what they need? (optional)",
                  true,
                )}
                {textField("help", "Who can help? (optional)", true)}
              </>
            )}
          </>
        )}
        <RecipientNoteField
          value={note}
          onChange={(value) => {
            setNote(value);
            setDirty(true);
          }}
        />
      </fieldset>
      <p className="text-sm text-muted-foreground">
        Saving does not send anything. Choose who receives this file in{" "}
        <Link to="/app/emergency-contacts" className="underline">
          Emergency contacts
        </Link>
        . All accounts in this document go to the same assigned recipients.
      </p>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <p className="text-sm text-muted-foreground" role="status">
        {busy
          ? "Saving securely…"
          : dirty
            ? "Changes have not been saved."
            : "Your changes stay on this page until you save."}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : initial ? "Save changes" : "Save to vault"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={cancel}
          disabled={busy}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
