import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { listVaultFiles, type VaultFile } from "@/lib/uacFilesApi";
import {
  UserPlus,
  MoreHorizontal,
  Trash2,
  Pencil,
  CheckCircle2,
  Clock,
  Send,
  Users,
  Shield,
  Loader2,
} from "lucide-react";

interface EmergencyContact {
  id: string;
  name: string;
  email: string;
  relationship: string;
  verified: boolean;
  assignedFiles: string[];
  addedAt: string;
}

type ApiListResp =
  | { ok: true; contacts: EmergencyContact[] }
  | { ok: false; error: string };

// Why an unverified contact still needs a confirmation email. Known only for actions taken
// in this session; the contacts API doesn't report whether an invite was ever sent.
type InviteIssue = "not_sent" | "send_failed" | "email_changed";

const inviteIssueText: Record<InviteIssue, string> = {
  not_sent: "No confirmation email has been sent yet.",
  send_failed: "The confirmation email couldn't be sent.",
  email_changed: "The email address changed, so they need to confirm the new address.",
};

function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

function emitPaywall(title?: string, description?: string) {
  const returnTo = window.location.pathname + window.location.search;
  window.dispatchEvent(
    new CustomEvent("uac:paywall", {
      detail: {
        title: title || "Paid feature",
        description:
          description ||
          "This feature is part of a paid plan. Build a plan starting at $4.99/month to unlock it.",
        returnTo,
      },
    })
  );
}

async function readJsonSafe(res: Response) {
  const txt = await res.text();
  try {
    return txt ? JSON.parse(txt) : null;
  } catch {
    return null;
  }
}

function isPaymentRequired(resp: Response, data: unknown) {
  const error = (data as { error?: unknown } | null)?.error;
  const code = error ? String(error) : "";
  return resp.status === 402 || code === "payment_required";
}

function formatBytes(bytes: number | null) {
  const b = typeof bytes === "number" ? bytes : 0;
  if (b <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  const v = b / Math.pow(k, i);
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
}

export function EmergencyContactsPage() {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);

  const [vaultFiles, setVaultFiles] = useState<VaultFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showFilesModal, setShowFilesModal] = useState(false);

  const [selectedContact, setSelectedContact] = useState<EmergencyContact | null>(null);
  const [loading, setLoading] = useState(false);

  const [skipNotify, setSkipNotify] = useState(false);
  const [showSkipNotifyConfirm, setShowSkipNotifyConfirm] = useState(false);
  const [inviteIssues, setInviteIssues] = useState<Record<string, InviteIssue>>({});

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRelationship, setFormRelationship] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  const { toast } = useToast();

  const filesByKey = useMemo(() => {
    const m = new Map<string, VaultFile>();
    for (const f of vaultFiles) m.set(f.key, f);
    return m;
  }, [vaultFiles]);

  const resetForm = () => {
    setFormName("");
    setFormEmail("");
    setFormRelationship("");
    setCurrentPassword("");
    setSelectedFiles([]);
    setSkipNotify(false);
  };

  const setInviteIssue = (contactId: string, issue: InviteIssue | null) => {
    setInviteIssues((prev) => {
      const next = { ...prev };
      if (issue) next[contactId] = issue;
      else delete next[contactId];
      return next;
    });
  };

  const showReauthFailed = () => {
    toast({
      title: "Incorrect password",
      description: "Enter your current account password to confirm this change.",
      variant: "destructive",
    });
  };

  const fetchContacts = async () => {
    try {
      const resp = await fetch("/auth/emergency-contacts", { credentials: "include" });
      const data = (await readJsonSafe(resp)) as ApiListResp | null;

      if (!resp.ok || !data || data.ok !== true) {
        if (isPaymentRequired(resp, data)) {
          emitPaywall(
            "Emergency contacts are a paid feature",
            "You can view the page, but adding or managing contacts requires an active plan."
          );
          setContacts([]);
          return;
        }

        const code = (data && "error" in data ? data.error : "") || "load_failed";

        if (code === "not_authenticated") {
          toast({
            title: "Please log in",
            description: "Your session is required to manage emergency contacts.",
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Could not load contacts",
          description: "Please refresh and try again.",
          variant: "destructive",
        });
        return;
      }

      setContacts(data.contacts);
    } catch {
      toast({
        title: "Network error",
        description: "Could not reach the server.",
        variant: "destructive",
      });
    }
  };

  const fetchFiles = async () => {
    setFilesLoading(true);
    try {
      const files = await listVaultFiles();
      setVaultFiles(Array.isArray(files) ? files : []);
    } catch (e: unknown) {
      const msg = String((e as Error | null)?.message || "");
      if (msg === "payment_required" || msg === "http_402") {
        setVaultFiles([]);
        setFilesLoading(false);
        return;
      }
      setVaultFiles([]);
    } finally {
      setFilesLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      setInitialLoading(true);
      await Promise.all([fetchContacts(), fetchFiles()]);
      setInitialLoading(false);
    })();
  }, []);

  const handleAddContact = async () => {
    if (!formName || !formEmail) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch("/auth/emergency-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: formName,
          email: formEmail,
          relationship: formRelationship,
          assignedFiles: selectedFiles,
          notifyContact: !skipNotify,
          password: currentPassword,
        }),
      });

      const data = await readJsonSafe(resp);

      if (!resp.ok || !data?.ok) {
        if (isPaymentRequired(resp, data)) {
          emitPaywall(
            "Add emergency contacts requires a plan",
            "Upgrade to add contacts and assign files."
          );
          return;
        }

        const code = data?.error || "create_failed";

        if (code === "contact_exists") {
          toast({
            title: "Contact already exists",
            description: "You already added this email as a contact.",
            variant: "destructive",
          });
          return;
        }

        if (code === "invalid_email") {
          toast({
            title: "Invalid email",
            description: "Please enter a valid email address.",
            variant: "destructive",
          });
          return;
        }

        if (code === "not_authenticated") {
          toast({
            title: "Session expired",
            description: "Please log in again.",
            variant: "destructive",
          });
          return;
        }

        if (code === "reauthentication_failed") {
          showReauthFailed();
          return;
        }

        toast({
          title: "Could not add contact",
          description: "Please try again.",
          variant: "destructive",
        });
        return;
      }

      const created = data.contact as EmergencyContact;
      const skippedInvite = skipNotify;
      const emailSent = data.email_sent === true;

      setContacts((prev) => [created, ...prev]);
      setShowAddModal(false);
      resetForm();

      if (skippedInvite) {
        setInviteIssue(created.id, "not_sent");
        toast({
          title: "Contact added, not verified",
          description: `No confirmation email was sent. ${created.name} won't receive any files until you send it with "Resend confirmation email" and they click the link.`,
        });
      } else if (emailSent) {
        toast({
          title: "Contact added",
          description: `We emailed ${created.email} a confirmation link. They need to click it within 2 days before they can receive any files.`,
        });
      } else {
        setInviteIssue(created.id, "send_failed");
        toast({
          title: "Confirmation email couldn't be sent",
          description: `${created.name} was added but won't receive any files until they confirm. Try "Resend confirmation email" on their contact card.`,
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Network error",
        description: "Could not reach the server.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditContact = async () => {
    if (!selectedContact) return;

    setLoading(true);
    try {
      const resp = await fetch(`/auth/emergency-contacts/${selectedContact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: formName,
          email: formEmail,
          relationship: formRelationship,
          password: currentPassword,
        }),
      });

      const data = await readJsonSafe(resp);

      if (!resp.ok || !data?.ok) {
        if (isPaymentRequired(resp, data)) {
          emitPaywall(
            "Editing contacts requires a plan",
            "Upgrade to edit contacts and manage assignments."
          );
          return;
        }

        const code = data?.error || "edit_failed";

        if (code === "contact_exists") {
          toast({
            title: "Email already used",
            description: "You already have a contact with that email.",
            variant: "destructive",
          });
          return;
        }

        if (code === "reauthentication_failed") {
          showReauthFailed();
          return;
        }

        if (code === "invalid_email") {
          toast({
            title: "Invalid email",
            description: "Please enter a valid email address.",
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Could not update contact",
          description: "Please try again.",
          variant: "destructive",
        });
        return;
      }

      // The server clears verification and cancels outstanding links when the email changes.
      const emailChanged = normalizeEmail(formEmail) !== normalizeEmail(selectedContact.email);
      const contactId = selectedContact.id;
      const savedName = formName.trim() || selectedContact.name;

      setContacts((prev) =>
        prev.map((c) =>
          c.id === contactId
            ? {
                ...c,
                name: savedName,
                email: normalizeEmail(formEmail),
                relationship: formRelationship.trim(),
                verified: emailChanged ? false : c.verified,
              }
            : c
        )
      );

      setShowEditModal(false);
      resetForm();

      if (emailChanged) {
        setInviteIssue(contactId, "email_changed");
        toast({
          title: "Contact updated, needs to verify again",
          description: `Because the email address changed, ${savedName} is no longer verified and links already sent to them were cancelled. Send a confirmation email to the new address with "Resend confirmation email".`,
        });
      } else {
        toast({
          title: "Contact updated",
          description: "Emergency contact details have been saved.",
        });
      }
    } catch {
      toast({
        title: "Network error",
        description: "Could not reach the server.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContact = async () => {
    if (!selectedContact) return;

    setLoading(true);
    try {
      const resp = await fetch(`/auth/emergency-contacts/${selectedContact.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: currentPassword }),
      });

      const data = await readJsonSafe(resp);

      if (!resp.ok || !data?.ok) {
        if (isPaymentRequired(resp, data)) {
          emitPaywall(
            "Removing contacts requires a plan",
            "Upgrade to manage contacts."
          );
          return;
        }

        if (data?.error === "reauthentication_failed") {
          showReauthFailed();
          return;
        }

        toast({
          title: "Could not remove contact",
          description: "Please try again.",
          variant: "destructive",
        });
        return;
      }

      setContacts((prev) => prev.filter((c) => c.id !== selectedContact.id));
      setShowDeleteModal(false);
      setSelectedContact(null);

      toast({
        title: "Contact removed",
        description: "The emergency contact has been deleted.",
      });
    } catch {
      toast({
        title: "Network error",
        description: "Could not reach the server.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateFiles = async () => {
    if (!selectedContact) return;

    setLoading(true);
    try {
      const resp = await fetch(`/auth/emergency-contacts/${selectedContact.id}/files`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fileIds: selectedFiles, password: currentPassword }),
      });

      const data = await readJsonSafe(resp);

      if (!resp.ok || !data?.ok) {
        if (isPaymentRequired(resp, data)) {
          emitPaywall(
            "Assigning files requires a plan",
            "Upgrade to assign files to your emergency contacts."
          );
          return;
        }

        if (data?.error === "reauthentication_failed") {
          showReauthFailed();
          return;
        }

        toast({
          title: "Could not save assignments",
          description: "Please try again.",
          variant: "destructive",
        });
        return;
      }

      setContacts((prev) =>
        prev.map((c) => (c.id === selectedContact.id ? { ...c, assignedFiles: selectedFiles } : c))
      );

      setShowFilesModal(false);

      toast({
        title: "Files updated",
        description: "File assignments have been saved.",
      });
    } catch {
      toast({
        title: "Network error",
        description: "Could not reach the server.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async (contact: EmergencyContact) => {
    setLoading(true);
    try {
      const resp = await fetch(`/auth/emergency-contacts/${contact.id}/resend`, {
        method: "POST",
        credentials: "include",
      });

      const data = await readJsonSafe(resp);

      if (!resp.ok || !data?.ok) {
        if (isPaymentRequired(resp, data)) {
          emitPaywall(
            "Resending verification requires a plan",
            "Upgrade to manage contacts."
          );
          return;
        }

        toast({
          title: "Could not resend",
          description: "Please try again.",
          variant: "destructive",
        });
        return;
      }

      if (data.email_sent !== true) {
        setInviteIssue(contact.id, "send_failed");
        toast({
          title: "Email couldn't be sent",
          description: `The confirmation email to ${contact.email} couldn't be sent. Please try "Resend confirmation email" again in a few minutes.`,
          variant: "destructive",
        });
        return;
      }

      setInviteIssue(contact.id, null);
      toast({
        title: "Confirmation email sent",
        description: `We sent a new confirmation link to ${contact.email}. It's valid for 2 days.`,
      });
    } catch {
      toast({
        title: "Network error",
        description: "Could not reach the server.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (contact: EmergencyContact) => {
    setCurrentPassword("");
    setSelectedContact(contact);
    setFormName(contact.name);
    setFormEmail(contact.email);
    setFormRelationship(contact.relationship);
    setShowEditModal(true);
  };

  const openFilesModal = (contact: EmergencyContact) => {
    setCurrentPassword("");
    setSelectedContact(contact);
    setSelectedFiles(Array.isArray(contact.assignedFiles) ? contact.assignedFiles : []);
    setShowFilesModal(true);
  };

  const openDeleteModal = (contact: EmergencyContact) => {
    setCurrentPassword("");
    setSelectedContact(contact);
    setShowDeleteModal(true);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Emergency Contacts</h1>
          <p className="text-muted-foreground">People who will receive your files if you miss check-ins</p>
        </div>
        <Button onClick={() => { setCurrentPassword(""); setShowAddModal(true); }} className="gap-2" disabled={initialLoading}>
          <UserPlus className="h-4 w-4" />
          Add contact
        </Button>
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="flex items-start gap-3 py-4">
          <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground">How it works</p>
            <p className="text-muted-foreground">
              If emergency delivery starts (you miss your check-in and the grace period ends, or you use your
              emergency PIN), each verified contact is emailed links to only the files you&apos;ve assigned to
              them. No files are shared before then.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>
                Each contact must confirm their email by clicking the link in the confirmation email. The link is
                valid for 2 days, and you can resend it. Contacts who haven&apos;t confirmed receive nothing.
              </li>
              <li>Contacts receive only the files you assign to them. A contact with no files assigned receives nothing.</li>
              <li>
                Delivery is by email only. We can&apos;t tell if an email bounces, so double-check each address.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {initialLoading ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-8 justify-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading contacts...
          </CardContent>
        </Card>
      ) : contacts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-foreground mb-1">No emergency contacts</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add trusted people who should receive your files
            </p>
            <Button onClick={() => { setCurrentPassword(""); setShowAddModal(true); }} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Add your first contact
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {contacts.map((contact) => {
            const assignedCount = Array.isArray(contact.assignedFiles) ? contact.assignedFiles.length : 0;
            const inviteIssue = inviteIssues[contact.id];
            return (
            <Card key={contact.id}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-lg">
                  {contact.name.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground truncate">{contact.name}</p>
                    {contact.verified ? (
                      <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 gap-1">
                        <Clock className="h-3 w-3" />
                        {inviteIssue === "not_sent" ? "Not invited" : "Not verified"}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{contact.email}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {contact.relationship && (
                      <>
                        <span>{contact.relationship}</span>
                        <span aria-hidden="true">•</span>
                      </>
                    )}
                    <span>
                      {assignedCount} file{assignedCount !== 1 ? "s" : ""} assigned
                    </span>
                  </div>

                  {assignedCount === 0 && (
                    <p className="mt-1 text-xs text-warning">No files assigned, so this contact will receive nothing.</p>
                  )}

                  {!contact.verified && (
                    <div className="mt-2 rounded-md border border-warning/20 bg-warning/5 px-3 py-2 text-xs">
                      <p className="text-foreground">
                        {inviteIssue
                          ? inviteIssueText[inviteIssue]
                          : "Waiting for them to confirm. If they didn't get the email or the 2-day link expired, resend it."}
                      </p>
                      <p className="mt-0.5 text-muted-foreground">
                        They won&apos;t receive any files until they click the confirmation email.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 min-h-11 sm:min-h-9"
                        onClick={() => handleResendVerification(contact)}
                        disabled={loading}
                      >
                        <Send className="h-3.5 w-3.5" />
                        Resend confirmation email
                      </Button>
                    </div>
                  )}

                  {assignedCount > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {contact.assignedFiles.slice(0, 2).map((key) => (
                        <div key={key} className="truncate">
                          {filesByKey.get(key)?.name || key}
                        </div>
                      ))}
                      {contact.assignedFiles.length > 2 && (
                        <div className="truncate">+{contact.assignedFiles.length - 2} more</div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => openFilesModal(contact)} disabled={loading}>
                    Manage files
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" disabled={loading} aria-label={`More actions for ${contact.name}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditModal(contact)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit contact
                      </DropdownMenuItem>
                      {!contact.verified && (
                        <DropdownMenuItem onClick={() => handleResendVerification(contact)}>
                          <Send className="mr-2 h-4 w-4" />
                          Resend confirmation email
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => openDeleteModal(contact)} className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove contact
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add emergency contact</DialogTitle>
            <DialogDescription>
              Once they confirm their email, this person can receive the files you assign to them if emergency
              delivery starts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="relationship">Relationship</Label>
              <Input
                id="relationship"
                placeholder="e.g., Spouse, Sibling, Attorney"
                value={formRelationship}
                onChange={(e) => setFormRelationship(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label>Assign files</Label>

              {filesLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading files...
                </div>
              ) : vaultFiles.length === 0 ? (
                <div className="text-sm text-muted-foreground py-2">Nothing uploaded</div>
              ) : (
                <div className="space-y-2 max-h-44 overflow-y-auto">
                  {vaultFiles.map((file) => (
                    <label htmlFor={`new-contact-file-${file.key}`}
                      key={file.key}
                      className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        id={`new-contact-file-${file.key}`}
                        checked={selectedFiles.includes(file.key)}
                        onCheckedChange={(checked) => {
                          setSelectedFiles(
                            checked
                              ? [...selectedFiles, file.key]
                              : selectedFiles.filter((k) => k !== file.key)
                          );
                        }}
                        disabled={loading}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{formatBytes(file.size_bytes)}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-2">
            <label htmlFor="skip-contact-notification" className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors">
              <Checkbox
                id="skip-contact-notification"
                checked={skipNotify}
                onCheckedChange={(checked) => {
                  if (checked) { setSkipNotify(false); setShowSkipNotifyConfirm(true); }
                  else setSkipNotify(false);
                }}
                disabled={loading}
              />
              <div className="text-sm leading-snug">
                <p className="font-medium text-foreground">
                  Don&apos;t send the confirmation email now
                </p>
                <p className="text-muted-foreground mt-1">
                  This person must confirm before they can receive anything. Until you send the confirmation email
                  and they click it, they won&apos;t receive files in an emergency.
                </p>
              </div>
            </label>
          </div>

	
          <div className="space-y-2">
            <Label htmlFor="add-contact-password">Current account password</Label>
            <Input id="add-contact-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" disabled={loading} />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddModal(false);
                setSkipNotify(false);
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={handleAddContact} disabled={loading || !currentPassword}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add contact"}
            </Button>
          </DialogFooter>
          <Dialog open={showSkipNotifyConfirm} onOpenChange={setShowSkipNotifyConfirm}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add without sending the confirmation email?</DialogTitle>
                <DialogDescription>
                  {formName.trim() || "This person"} won&apos;t be able to confirm and won&apos;t receive any files in
                  an emergency until you send the confirmation email (&quot;Resend confirmation email&quot; on their
                  contact card) and they click the link.
                </DialogDescription>
              </DialogHeader>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowSkipNotifyConfirm(false);
                    setSkipNotify(false);
                  }}
                  disabled={loading}
                >
                  Go back
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setShowSkipNotifyConfirm(false);
                    setSkipNotify(true);
                  }}
                  disabled={loading}
                >
                  Yes, don&apos;t send it now
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </DialogContent>
      </Dialog>

      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit contact</DialogTitle>
            <DialogDescription>Update the contact&apos;s information.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full name</Label>
              <Input
                id="edit-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email address</Label>
              <Input
                id="edit-email"
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                disabled={loading}
                aria-describedby="edit-email-help"
              />
              <p id="edit-email-help" className="text-xs text-muted-foreground">
                Changing the email removes this contact&apos;s verification and cancels links already sent to them.
                They&apos;ll need to confirm the new address.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-relationship">Relationship</Label>
              <Input
                id="edit-relationship"
                value={formRelationship}
                onChange={(e) => setFormRelationship(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-contact-password">Current account password</Label>
              <Input id="edit-contact-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" disabled={loading} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleEditContact} disabled={loading || !currentPassword}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showFilesModal} onOpenChange={setShowFilesModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign files to {selectedContact?.name}</DialogTitle>
            <DialogDescription>
              Select which files this contact should receive. Saving changes cancels any emergency links already
              sent to them.
            </DialogDescription>
          </DialogHeader>

          {filesLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading files...
            </div>
          ) : vaultFiles.length === 0 ? (
            <div className="text-sm text-muted-foreground py-2">Nothing uploaded</div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {vaultFiles.map((file) => (
                <label htmlFor={`assign-contact-file-${file.key}`}
                  key={file.key}
                  className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    id={`assign-contact-file-${file.key}`}
                    checked={selectedFiles.includes(file.key)}
                    onCheckedChange={(checked) => {
                      setSelectedFiles(
                        checked ? [...selectedFiles, file.key] : selectedFiles.filter((k) => k !== file.key)
                      );
                    }}
                    disabled={loading}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(file.size_bytes)}</p>
                  </div>
                </label>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="assign-files-password">Current account password</Label>
            <Input id="assign-files-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" disabled={loading} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFilesModal(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleUpdateFiles} disabled={loading || !currentPassword}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save assignments"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove contact</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {selectedContact?.name} as an emergency contact?
              They will no longer receive any files.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="delete-contact-password">Current account password</Label>
            <Input id="delete-contact-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" disabled={loading} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteContact} disabled={loading || !currentPassword}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
