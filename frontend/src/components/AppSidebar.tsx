import { LayoutDashboard, Users, ClipboardList, Clock, Building2, PenSquare, CheckSquare } from "lucide-react";
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
  { title: "Data Pegawai", url: "/pegawai", icon: Users },
  { title: "Data Absensi", url: "/absensi", icon: ClipboardList },
  { title: "Rekap Harian", url: "/rekap", icon: Building2 },
  { title: "Laporan Departemen", url: "/laporan-departemen", icon: ClipboardList },
  { title: "Form Lembur", url: "/lembur", icon: PenSquare },
  { title: "Approval Lembur", url: "/approval-lembur", icon: CheckSquare },
  { title: "Live Clock-In", url: "/clock-in", icon: Clock },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user } = useAuth();

  const filteredItems = items.filter(item => {
    if (item.url === "/approval-lembur") {
       const isHRD = user?.role === 'Admin' || (user?.departemen && (user.departemen.includes('SDM') || user.departemen.includes('HRD') || user.departemen.includes('Personalia')));
       const isSupervisor = user?.jnj_jabatan && user.jnj_jabatan !== '-' && user.jnj_jabatan !== 'STAFF';
       return isHRD || isSupervisor;
    }
    return true;
  });

  return (
    <Sidebar collapsible="icon" className="gradient-sidebar border-r-0">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 py-6 mb-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sidebar-primary/20">
                <Building2 className="w-5 h-5 text-sidebar-primary" />
              </div>
              {!collapsed && (
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-sidebar-foreground">RS Permata</p>
                  <p className="text-xs text-sidebar-muted">HR System</p>
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
