import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { mockFiles } from '@/lib/mockApi';
import {
  UserPlus, MoreHorizontal, Trash2, Pencil,
  CheckCircle2, Clock, Send, Users, Shield, Loader2
} from 'lucide-react';

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

export function EmergencyContactsPage() {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showFilesModal, setShowFilesModal] = useState(false);

  const [selectedContact, setSelectedContact] = useState<EmergencyContact | null>(null);
  const [loading, setLoading] = useState(false);

  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRelationship, setFormRelationship] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  const { toast } = useToast();

  const filesById = useMemo(() => {
    const m = new Map<string, { id: string; name: string; size: number }>();
    for (const f of mockFiles) m.set(f.id, f);
    return m;
  }, []);

  const resetForm = () => {
    setFormName('');
    setFormEmail('');
    setFormRelationship('');
    setSelectedFiles([]);
  };

  const fetchContacts = async () => {
    try {
      const resp = await fetch('/auth/emergency-contacts', { credentials: 'include' });
      const data = (await resp.json().catch(() => null)) as ApiListResp | null;

      if (!resp.ok || !data || data.ok === false) {
        const code = (data && 'error' in data ? data.error : '') || 'load_failed';
        if (code === 'not_authenticated') {
          toast({
            title: 'Please log in',
            description: 'Your session is required to manage emergency contacts.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Could not load contacts',
            description: 'Please refresh and try again.',
            variant: 'destructive',
          });
        }
        return;
      }

      setContacts(data.contacts);
    } catch {
      toast({
        title: 'Network error',
        description: 'Could not reach the server.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    (async () => {
      setInitialLoading(true);
      await fetchContacts();
      setInitialLoading(false);
    })();
  }, []);

  const handleAddContact = async () => {
    if (!formName || !formEmail) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch('/auth/emergency-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: formName,
          email: formEmail,
          relationship: formRelationship,
          assignedFiles: selectedFiles,
        }),
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok || !data?.ok) {
        const code = data?.error || 'create_failed';

        if (code === 'contact_exists') {
          toast({
            title: 'Contact already exists',
            description: 'You already added this email as a contact.',
            variant: 'destructive',
          });
          return;
        }

        if (code === 'invalid_email') {
          toast({
            title: 'Invalid email',
            description: 'Please enter a valid email address.',
            variant: 'destructive',
          });
          return;
        }

        if (code === 'not_authenticated') {
          toast({
            title: 'Session expired',
            description: 'Please log in again.',
            variant: 'destructive',
          });
          return;
        }

        toast({
          title: 'Could not add contact',
          description: 'Please try again.',
          variant: 'destructive',
        });
        return;
      }

      setContacts((prev) => [data.contact as EmergencyContact, ...prev]);
      setShowAddModal(false);
      resetForm();

      toast({
        title: 'Contact added',
        description: 'A verification email has been sent to your contact.',
      });
    } catch {
      toast({
        title: 'Network error',
        description: 'Could not reach the server.',
        variant: 'destructive',
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
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: formName,
          email: formEmail,
          relationship: formRelationship,
        }),
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok || !data?.ok) {
        const code = data?.error || 'edit_failed';

        if (code === 'contact_exists') {
          toast({
            title: 'Email already used',
            description: 'You already have a contact with that email.',
            variant: 'destructive',
          });
          return;
        }

        toast({
          title: 'Could not update contact',
          description: 'Please try again.',
          variant: 'destructive',
        });
        return;
      }

      setContacts((prev) =>
        prev.map((c) =>
          c.id === selectedContact.id
            ? { ...c, name: formName, email: formEmail, relationship: formRelationship }
            : c
        )
      );

      setShowEditModal(false);
      resetForm();

      toast({
        title: 'Contact updated',
        description: 'Emergency contact details have been saved.',
      });
    } catch {
      toast({
        title: 'Network error',
        description: 'Could not reach the server.',
        variant: 'destructive',
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
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok || !data?.ok) {
        toast({
          title: 'Could not remove contact',
          description: 'Please try again.',
          variant: 'destructive',
        });
        return;
      }

      setContacts((prev) => prev.filter((c) => c.id !== selectedContact.id));
      setShowDeleteModal(false);
      setSelectedContact(null);

      toast({
        title: 'Contact removed',
        description: 'The emergency contact has been deleted.',
      });
    } catch {
      toast({
        title: 'Network error',
        description: 'Could not reach the server.',
        variant: 'destructive',
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
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fileIds: selectedFiles }),
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok || !data?.ok) {
        toast({
          title: 'Could not save assignments',
          description: 'Please try again.',
          variant: 'destructive',
        });
        return;
      }

      setContacts((prev) =>
        prev.map((c) => (c.id === selectedContact.id ? { ...c, assignedFiles: selectedFiles } : c))
      );

      setShowFilesModal(false);

      toast({
        title: 'Files updated',
        description: 'File assignments have been saved.',
      });
    } catch {
      toast({
        title: 'Network error',
        description: 'Could not reach the server.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async (contact: EmergencyContact) => {
    setLoading(true);
    try {
      const resp = await fetch(`/auth/emergency-contacts/${contact.id}/resend`, {
        method: 'POST',
        credentials: 'include',
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok || !data?.ok) {
        toast({
          title: 'Could not resend',
          description: 'Please try again.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Verification sent',
        description: `A new verification email has been sent to ${contact.email}.`,
      });
    } catch {
      toast({
        title: 'Network error',
        description: 'Could not reach the server.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (contact: EmergencyContact) => {
    setSelectedContact(contact);
    setFormName(contact.name);
    setFormEmail(contact.email);
    setFormRelationship(contact.relationship);
    setShowEditModal(true);
  };

  const openFilesModal = (contact: EmergencyContact) => {
    setSelectedContact(contact);
    setSelectedFiles(contact.assignedFiles);
    setShowFilesModal(true);
  };

  const openDeleteModal = (contact: EmergencyContact) => {
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
        <Button onClick={() => setShowAddModal(true)} className="gap-2" disabled={initialLoading}>
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
              If you miss your check-in and the grace period expires, only the files you&apos;ve assigned
              to each contact will be sent to them. Nothing is shared until then.
            </p>
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
            <Button onClick={() => setShowAddModal(true)} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Add your first contact
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {contacts.map((contact) => (
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
                        Pending
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{contact.email}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{contact.relationship}</span>
                    <span>•</span>
                    <span>{contact.assignedFiles.length} file{contact.assignedFiles.length !== 1 ? 's' : ''} assigned</span>
                  </div>

                  {contact.assignedFiles.length > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {contact.assignedFiles.slice(0, 2).map((fid) => (
                        <div key={fid} className="truncate">
                          {filesById.get(fid)?.name || fid}
                        </div>
                      ))}
                      {contact.assignedFiles.length > 2 && (
                        <div className="truncate">+{contact.assignedFiles.length - 2} more</div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openFilesModal(contact)}
                    disabled={loading}
                  >
                    Manage files
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" disabled={loading}>
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
                          Resend verification
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => openDeleteModal(contact)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove contact
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add emergency contact</DialogTitle>
            <DialogDescription>
              This person will receive your assigned files if you miss check-ins.
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
              <div className="space-y-2 max-h-44 overflow-y-auto">
                {mockFiles.map((file) => (
                  <label
                    key={file.id}
                    className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedFiles.includes(file.id)}
                      onCheckedChange={(checked) => {
                        setSelectedFiles(
                          checked
                            ? [...selectedFiles, file.id]
                            : selectedFiles.filter((id) => id !== file.id)
                        );
                      }}
                      disabled={loading}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                These are placeholders for now. Later, this will come from your real S3-backed file list.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleAddContact} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add contact'}
            </Button>
          </DialogFooter>
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
              />
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleEditContact} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showFilesModal} onOpenChange={setShowFilesModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign files to {selectedContact?.name}</DialogTitle>
            <DialogDescription>Select which files this contact should receive.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {mockFiles.map((file) => (
              <label
                key={file.id}
                className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  checked={selectedFiles.includes(file.id)}
                  onCheckedChange={(checked) => {
                    setSelectedFiles(
                      checked ? [...selectedFiles, file.id] : selectedFiles.filter((id) => id !== file.id)
                    );
                  }}
                  disabled={loading}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFilesModal(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleUpdateFiles} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save assignments'}
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteContact} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Remove contact'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
