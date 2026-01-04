import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
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
  ShieldCheck,
  LayoutDashboard,
  Users,
  CreditCard,
  Send,
  Activity,
  Settings,
  HeartPulse,
  LogOut,
  Menu,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const adminSidebarItems = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Users', href: '/admin/users', icon: Users },
  { label: 'Billing & Plans', href: '/admin/billing', icon: CreditCard },
  { label: 'Campaigns', href: '/admin/campaigns', icon: Send },
  { label: 'Audit Log', href: '/admin/audit', icon: Activity },
  { label: 'System Health', href: '/admin/health', icon: HeartPulse },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
];

function AdminSidebarContent({ onItemClick }: { onItemClick?: () => void }) {
  const location = useLocation();

  return (
    <nav className="flex-1 p-4 space-y-1">
      {adminSidebarItems.map((item) => {
        const isActive = location.pathname === item.href || 
          (item.href !== '/admin' && location.pathname.startsWith(item.href));
        
        return (
          <Link
            key={item.href}
            to={item.href}
            onClick={onItemClick}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
              isActive 
                ? "bg-warning text-warning-foreground shadow-md" 
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

export function AdminLayout() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-border bg-vault text-vault-foreground">
        <div className="h-16 flex items-center gap-2 px-6 border-b border-vault-foreground/10">
          <Link to="/admin" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-warning flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-warning-foreground" />
            </div>
            <div>
              <span className="font-semibold">UnderAnyCircumstance</span>
              <span className="text-xs text-vault-foreground/60 block -mt-0.5">Admin</span>
            </div>
          </Link>
        </div>
        <AdminSidebarContent />
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
            <SheetContent side="left" className="w-64 p-0 bg-vault text-vault-foreground">
              <div className="h-16 flex items-center gap-2 px-6 border-b border-vault-foreground/10">
                <div className="h-8 w-8 rounded-lg bg-warning flex items-center justify-center">
                  <ShieldCheck className="h-4 w-4 text-warning-foreground" />
                </div>
                <div>
                  <span className="font-semibold">UnderAnyCircumstance</span>
                  <span className="text-xs text-vault-foreground/60 block -mt-0.5">Admin</span>
                </div>
              </div>
              <AdminSidebarContent onItemClick={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-warning/10 text-warning border border-warning/20">
              Admin Portal
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-warning text-warning-foreground text-sm">
                      AD
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">Admin User</p>
                  <p className="text-xs text-muted-foreground">admin@underanycircumstance.com</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/admin/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
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
        <main className="flex-1 overflow-y-auto bg-muted/30">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
