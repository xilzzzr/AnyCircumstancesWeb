import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Shield,
  Upload,
  Bell,
  LayoutDashboard,
  FolderLock,
  CheckCircle2,
  Users,
  CreditCard,
  Activity,
  Settings,
  HelpCircle,
  Lightbulb,
  LogOut,
  Menu,
  Lock,
  Unlock,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

type VaultFile = {
  key: string;
  name: string;
  content_type: string;
  size_bytes: number | null;
  created_at: string;
  include_in_emergency: boolean;
};

type BillingSummaryResp = {
  ok?: boolean;
  billing?: { storageLimitGb?: number | null };
  profile?: { storageLimitGb?: number | null };
  subscription?: { storageLimitGb?: number | null };
};

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL ?? "";

const sidebarItems = [
  { label: 'Dashboard', href: '/app', icon: LayoutDashboard },
  { label: 'Vault', href: '/app/vault', icon: FolderLock },
  { label: 'Upload', href: '/app/upload', icon: Upload },
  { label: 'Verification', href: '/app/verification', icon: CheckCircle2 },
  { label: 'Emergency Contacts', href: '/app/emergency-contacts', icon: Users },
  { label: 'Billing', href: '/app/billing', icon: CreditCard },
  { label: 'Activity Logs', href: '/app/activity', icon: Activity },
  { label: 'Ideas', href: '/scenarios', icon: Lightbulb },
  { label: 'Settings', href: '/app/settings', icon: Settings },
  { label: 'Help', href: '/app/help', icon: HelpCircle },
];

function getInitials(name?: string | null, email?: string | null) {
  const n = String(name || '').trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] || '' : '';
    return (first + last).toUpperCase() || first.toUpperCase();
  }

  const e = String(email || '').trim();
  if (e) {
    const beforeAt = e.split('@')[0] || '';
    const letters = beforeAt.replace(/[^a-zA-Z]/g, '');
    return (letters.slice(0, 2) || beforeAt.slice(0, 2)).toUpperCase();
  }

  return 'U';
}

function formatBytes(bytes: number) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  const rounded = i === 0 ? String(Math.round(v)) : v.toFixed(v >= 10 ? 1 : 2);
  return `${rounded} ${units[i]}`;
}

function SidebarContent({ onItemClick }: { onItemClick?: () => void }) {
  const location = useLocation();

  return (
    <nav className="flex-1 px-3 py-5 space-y-1.5">
      {sidebarItems.map((item) => {
        const isActive = location.pathname === item.href ||
          (item.href !== '/app' && location.pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            to={item.href}
            onClick={onItemClick}
            className={cn(
              "app-nav-item flex items-center gap-3 px-3 py-2.5 rounded-full text-xs font-medium transition-all",
              isActive
                ? "is-active"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppLayout() {
  const { user, logout, vaultLocked, lockVault } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const [storageUsedBytes, setStorageUsedBytes] = useState<number | null>(null);
  const [storageLimitBytes, setStorageLimitBytes] = useState<number | null>(null);

  const initials = useMemo(
    () => getInitials((user as any)?.name, (user as any)?.email),
    [user]
  );

  const storagePercent = useMemo(() => {
    if (storageUsedBytes === null || storageLimitBytes === null) return 0;
    if (!Number.isFinite(storageUsedBytes) || !Number.isFinite(storageLimitBytes)) return 0;
    if (storageLimitBytes <= 0) return 0;
    return Math.min(100, (storageUsedBytes / storageLimitBytes) * 100);
  }, [storageUsedBytes, storageLimitBytes]);

  useEffect(() => {
    let alive = true;

    async function fetchJson(path: string) {
      const r = await fetch(`${API_BASE}${path}`, { credentials: "include" });
      if (!r.ok) {
        const body = await r.json().catch(() => null);
        const err = new Error(body?.error || `http_${r.status}`);
        (err as any).status = r.status;
        throw err;
      }
      return r.json();
    }

    async function loadStorage() {
      try {
        const [filesOut, billingOut] = await Promise.all([
          fetchJson("/files/list"),
          fetchJson("/auth/billing/summary?limit=1"),
        ]);

        if (!alive) return;

        const files: VaultFile[] = Array.isArray(filesOut?.files) ? filesOut.files : [];
        const used = files.reduce((sum, f) => {
          const b = Number(f?.size_bytes);
          return sum + (Number.isFinite(b) && b > 0 ? b : 0);
        }, 0);

        const s: BillingSummaryResp = billingOut || {};
        const rawGb =
          (s as any)?.billing?.storageLimitGb ??
          (s as any)?.profile?.storageLimitGb ??
          (s as any)?.subscription?.storageLimitGb ??
          null;

        const gb = Number(rawGb);
        const limit = Number.isFinite(gb) && gb > 0 ? Math.round(gb * 1024 * 1024 * 1024) : null;

        setStorageUsedBytes(used);
        setStorageLimitBytes(limit);
      } catch {
        if (!alive) return;
        setStorageUsedBytes(null);
        setStorageLimitBytes(null);
      }
    }

    loadStorage();
    const t = window.setInterval(loadStorage, 15000);

    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="app-shell min-h-screen flex bg-background">
      <a className="skip-link" href="#app-main-content">Skip to main content</a>
      <aside className="app-sidebar hidden lg:flex flex-col w-60 border-r border-border bg-card">
        <div className="h-20 flex items-center gap-2 px-6 border-b border-border">
          <Link to="/" className="flex items-center gap-2">
            <div className="app-logo h-8 w-8 rounded-full flex items-center justify-center">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-medium tracking-tight text-foreground">anycircumstances</span>
          </Link>
        </div>
        <SidebarContent />

        <div className="p-4 border-t border-border">
          <button
            onClick={() => vaultLocked ? navigate('/app/check-in') : lockVault()}
            className={cn(
                "vault-status w-full flex items-center gap-3 px-3 py-2.5 rounded-full text-xs font-medium transition-all",
              vaultLocked
                ? "bg-warning/10 text-warning hover:bg-warning/20"
                : "bg-success/10 text-success hover:bg-success/20"
            )}
          >
            {vaultLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            {vaultLocked ? 'Vault Locked' : 'Vault Unlocked'}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="app-header h-20 border-b border-border bg-card flex items-center justify-between px-4 lg:px-8 gap-4">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon" className="icon-button" aria-label="Open navigation menu">
                <Menu aria-hidden="true" className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="h-16 flex items-center gap-2 px-6 border-b border-border">
                <div className="app-logo h-8 w-8 rounded-full flex items-center justify-center">
                  <Shield className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="font-semibold text-foreground">anycircumstances</span>
              </div>
              <SidebarContent onItemClick={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="hidden sm:flex items-center gap-3 flex-1 max-w-xs">
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Storage</span>
                <span className="font-medium">
                  {storageUsedBytes === null ? "—" : formatBytes(storageUsedBytes)}
                </span>
              </div>
              <Progress value={storagePercent} className="h-1.5" />
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Link to="/app/upload">
              <Button size="sm" className="gap-2 shadow-md">
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Upload</span>
              </Button>
            </Link>

            <Button variant="ghost" size="icon" className="relative icon-button" aria-label="Notifications, unread items">
              <Bell aria-hidden="true" className="h-5 w-5" />
              <span aria-hidden="true" className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full icon-button" aria-label="Open account menu">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{(user as any)?.name}</p>
                  <p className="text-xs text-muted-foreground">{(user as any)?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/app/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  Profile settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main id="app-main-content" tabIndex={-1} className="app-main flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
