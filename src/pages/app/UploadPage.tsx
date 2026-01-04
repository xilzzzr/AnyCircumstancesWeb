import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, X, FileText, Check, Loader2, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: 'encrypting' | 'uploading' | 'complete' | 'error';
  includeInEmergency: boolean;
}

export function UploadPage() {
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const { toast } = useToast();

  const handleFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles) return;
    
    const uploadFiles: UploadingFile[] = Array.from(newFiles).map(file => ({
      id: `${Date.now()}-${file.name}`,
      file,
      progress: 0,
      status: 'encrypting' as const,
      includeInEmergency: true,
    }));

    setFiles(prev => [...prev, ...uploadFiles]);

    // Simulate upload process
    uploadFiles.forEach(uf => {
      setTimeout(() => {
        setFiles(prev => prev.map(f => f.id === uf.id ? { ...f, status: 'uploading', progress: 30 } : f));
      }, 1000);
      setTimeout(() => {
        setFiles(prev => prev.map(f => f.id === uf.id ? { ...f, progress: 70 } : f));
      }, 2000);
      setTimeout(() => {
        setFiles(prev => prev.map(f => f.id === uf.id ? { ...f, status: 'complete', progress: 100 } : f));
        toast({ title: 'File uploaded', description: `${uf.file.name} has been encrypted and stored.` });
      }, 3000);
    });
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Upload Files</h1>
        <p className="text-muted-foreground">Files are encrypted on your device before upload.</p>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-2xl p-12 text-center transition-all",
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        )}
      >
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Upload className="h-8 w-8 text-primary" />
        </div>
        <h3 className="font-semibold text-foreground mb-2">Drop files here</h3>
        <p className="text-sm text-muted-foreground mb-4">or click to browse</p>
        <input
          type="file"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
          id="file-input"
        />
        <label htmlFor="file-input">
          <Button variant="outline" asChild>
            <span>Choose files</span>
          </Button>
        </label>
      </div>

      {/* Upload Queue */}
      {files.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-foreground">Upload Queue</h3>
          {files.map((uf) => (
            <Card key={uf.id}>
              <CardContent className="flex items-center gap-4 py-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  {uf.status === 'complete' ? (
                    <Check className="h-5 w-5 text-success" />
                  ) : (
                    <FileText className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{uf.file.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {uf.status === 'encrypting' && (
                      <span className="text-xs text-warning flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Encrypting...
                      </span>
                    )}
                    {uf.status === 'uploading' && (
                      <span className="text-xs text-primary flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Uploading...
                      </span>
                    )}
                    {uf.status === 'complete' && (
                      <span className="text-xs text-success">Complete</span>
                    )}
                    <Progress value={uf.progress} className="h-1 flex-1 max-w-24" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Shield className={cn("h-4 w-4", uf.includeInEmergency ? "text-primary" : "text-muted-foreground")} />
                    <Switch
                      checked={uf.includeInEmergency}
                      onCheckedChange={(checked) => {
                        setFiles(prev => prev.map(f => f.id === uf.id ? { ...f, includeInEmergency: checked } : f));
                      }}
                    />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeFile(uf.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
