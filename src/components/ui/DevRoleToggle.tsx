import { useAuth, UserRole } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { User, ShieldCheck, LogOut, Bug } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export function DevRoleToggle() {
  const { role, setRole } = useAuth();

  const roleConfig: Record<UserRole, { label: string; icon: React.ReactNode; color: string }> = {
    user: { label: 'User', icon: <User className="h-3.5 w-3.5" />, color: 'bg-primary' },
    admin: { label: 'Admin', icon: <ShieldCheck className="h-3.5 w-3.5" />, color: 'bg-warning' },
    logged_out: { label: 'Logged Out', icon: <LogOut className="h-3.5 w-3.5" />, color: 'bg-muted-foreground' },
  };

  const current = roleConfig[role];

  return (
    <div className="fixed bottom-4 right-4 z-[100]">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2 shadow-lg border-2 border-dashed border-warning/50 bg-card hover:bg-card"
          >
            <Bug className="h-3.5 w-3.5 text-warning" />
            <span className="text-xs font-medium">DEV</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-primary-foreground ${current.color}`}>
              {current.icon}
              {current.label}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Switch Role (Dev Only)
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={() => setRole('user')}
            className={role === 'user' ? 'bg-accent' : ''}
          >
            <User className="mr-2 h-4 w-4" />
            User View
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setRole('admin')}
            className={role === 'admin' ? 'bg-accent' : ''}
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            Admin View
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setRole('logged_out')}
            className={role === 'logged_out' ? 'bg-accent' : ''}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logged Out View
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
