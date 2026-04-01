import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { LogOut, UserCircle } from "lucide-react";

export function AppTopbar() {
  const { user, logout } = useAuth();

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <span className="text-sm font-medium text-muted-foreground hidden sm:inline">
          HR Assistant — RS Permata Keluarga Karawang
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm">
          <UserCircle className="w-5 h-5 text-primary" />
          <span className="font-medium hidden sm:inline">{user?.nama}</span>
          <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full">{user?.role}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={logout} title="Logout">
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
