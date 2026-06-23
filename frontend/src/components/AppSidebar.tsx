import { LayoutDashboard, ClipboardList, Clock, Building2, ShieldCheck, Timer, RefreshCw, ListCollapse } from "lucide-react";
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

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Data Absensi", url: "/absensi", icon: ListCollapse },
  { title: "Laporan Departemen", url: "/laporan-departemen", icon: ClipboardList },
  { title: "User SIKKRW", url: "/sikk-users", icon: ShieldCheck },
  { title: "Lembur Finder", url: "/lembur-finder", icon: Timer },
  { title: "Live Clock-In", url: "/clock-in", icon: Clock },
  { title: "Sinkronisasi", url: "/sync", icon: RefreshCw },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user } = useAuth();

  const filteredItems = items;

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
                  <p className="text-xs text-sidebar-muted font-medium">HR System</p>
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
