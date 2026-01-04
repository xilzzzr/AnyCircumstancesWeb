import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { mockFiles, formatBytes, formatDate } from '@/lib/mockApi';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Search, Upload, Filter, MoreHorizontal, Download, Trash2, 
  FileText, Image, Video, Archive, Lock, Shield
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return Image;
  if (type.startsWith('video/')) return Video;
  if (type.includes('zip') || type.includes('archive')) return Archive;
  return FileText;
};

export function VaultPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [unlockModal, setUnlockModal] = useState(false);
  const [pin, setPin] = useState('');
  const { vaultLocked, unlockVault } = useAuth();
  const { toast } = useToast();

  const filteredFiles = mockFiles.filter(f => 
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleDownload = (fileId: string) => {
    if (vaultLocked) {
      setUnlockModal(true);
      return;
    }
    toast({ title: 'Download started', description: 'Your file is being decrypted and downloaded.' });
  };

  const handleUnlock = async () => {
    const success = await unlockVault(pin);
    if (success) {
      setUnlockModal(false);
      setPin('');
      toast({ title: 'Vault unlocked', description: 'You can now download files.' });
    } else {
      toast({ title: 'Invalid PIN', variant: 'destructive' });
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vault</h1>
          <p className="text-muted-foreground">{mockFiles.length} encrypted files</p>
        </div>
        <Link to="/app/upload">
          <Button className="gap-2">
            <Upload className="h-4 w-4" /> Upload files
          </Button>
        </Link>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* Vault Lock Status */}
      {vaultLocked && (
        <Card className="bg-warning/5 border-warning/20">
          <CardContent className="flex items-center gap-3 py-3">
            <Lock className="h-5 w-5 text-warning" />
            <span className="text-sm">Vault is locked. Enter PIN or use passkey to download files.</span>
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => setUnlockModal(true)}>
              Unlock
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Files List */}
      <div className="space-y-2">
        {filteredFiles.map((file) => {
          const Icon = getFileIcon(file.type);
          return (
            <Card key={file.id} className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-center gap-4 py-3">
                <Checkbox 
                  checked={selected.includes(file.id)}
                  onCheckedChange={(checked) => {
                    setSelected(checked 
                      ? [...selected, file.id] 
                      : selected.filter(id => id !== file.id)
                    );
                  }}
                />
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{file.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatBytes(file.size)}</span>
                    <span>•</span>
                    <span>{formatDate(file.uploadedAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {file.includeInEmergency && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Shield className="h-3 w-3" /> Emergency
                    </Badge>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleDownload(file.id)}>
                        <Download className="mr-2 h-4 w-4" /> Download
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Unlock Modal */}
      <Dialog open={unlockModal} onOpenChange={setUnlockModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unlock Vault</DialogTitle>
            <DialogDescription>Enter your PIN to access encrypted files.</DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            placeholder="Enter PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnlockModal(false)}>Cancel</Button>
            <Button onClick={handleUnlock}>Unlock</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
