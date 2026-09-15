import { LayoutDashboard, ClipboardList, Timer, RefreshCw, ListCollapse, ShieldCheck } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  roles?: ("IT" | "HRD" | "STAFF")[];
}

const items: MenuItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Data Absensi", url: "/absensi", icon: ListCollapse },
  { title: "Lembur Finder", url: "/lembur-finder", icon: Timer },
  { title: "Laporan Departemen", url: "/laporan-departemen", icon: ClipboardList, roles: ["IT"] },
  { title: "Sinkronisasi", url: "/sync", icon: RefreshCw, roles: ["IT"] },
  { title: "Hak Akses", url: "/hak-akses", icon: ShieldCheck, roles: ["IT"] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user } = useAuth();

  const userRole = (user?.role || "STAFF") as "IT" | "HRD" | "STAFF";

  // Filter menu sesuai role user
  const filteredItems = items.filter((item) => {
    if (!item.roles) return true;
    return item.roles.includes(userRole);
  });

  return (
    <Sidebar collapsible="icon" className="gradient-sidebar border-r border-sidebar-border">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 py-7 mb-2 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-white p-1.5 shadow-card shrink-0">
                <img src="/image/logoBersih.png" alt="Logo" className="w-full h-full object-contain" />
              </div>
              {!collapsed && (
                <div className="leading-tight animate-scale-in">
                  <p className="text-sm font-bold text-sidebar-foreground tracking-tight">RS Permata Keluarga</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-xs text-sidebar-muted font-medium">HR System</p>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-sidebar-accent font-semibold text-primary">
                      {userRole}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="w-5 h-5 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
