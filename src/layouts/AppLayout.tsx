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
  LogOut,
  Menu,
  Lock,
  Unlock,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

const sidebarItems = [
  { label: 'Dashboard', href: '/app', icon: LayoutDashboard },
  { label: 'Vault', href: '/app/vault', icon: FolderLock },
  { label: 'Upload', href: '/app/upload', icon: Upload },
  { label: 'Verification', href: '/app/verification', icon: CheckCircle2 },
  { label: 'Emergency Contacts', href: '/app/emergency-contacts', icon: Users },
  { label: 'Billing', href: '/app/billing', icon: CreditCard },
  { label: 'Activity Logs', href: '/app/activity', icon: Activity },
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

function SidebarContent({ onItemClick }: { onItemClick?: () => void }) {
  const location = useLocation();

  return (
    <nav className="flex-1 p-4 space-y-1">
      {sidebarItems.map((item) => {
        const isActive = location.pathname === item.href ||
          (item.href !== '/app' && location.pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            to={item.href}
            onClick={onItemClick}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
              isActive
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
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

  const storagePercent = user ? (user.storageUsed / user.storageLimit) * 100 : 0;

  const initials = useMemo(
    () => getInitials((user as any)?.name, (user as any)?.email),
    [user]
  );

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-border bg-card">
        <div className="h-16 flex items-center gap-2 px-6 border-b border-border">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-security flex items-center justify-center">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">UnderAnyCircumstance</span>
          </Link>
        </div>
        <SidebarContent />

        {/* Vault Lock Status */}
        <div className="p-4 border-t border-border">
          <button
            onClick={() => vaultLocked ? navigate('/app/check-in') : lockVault()}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
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

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 lg:px-6 gap-4">
          {/* Mobile Menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="h-16 flex items-center gap-2 px-6 border-b border-border">
                <div className="h-8 w-8 rounded-lg bg-gradient-security flex items-center justify-center">
                  <Shield className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="font-semibold text-foreground">UnderAnyCircumstance</span>
              </div>
              <SidebarContent onItemClick={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          {/* Storage Display */}
          <div className="hidden sm:flex items-center gap-3 flex-1 max-w-xs">
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Storage</span>
                <span className="font-medium">{user?.storageUsed || 0} MB</span>
              </div>
              <Progress value={storagePercent} className="h-1.5" />
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Upload Button */}
            <Link to="/app/upload">
              <Button size="sm" className="gap-2 shadow-md">
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Upload</span>
              </Button>
            </Link>

            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" />
            </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
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

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}