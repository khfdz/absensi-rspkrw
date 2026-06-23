import { useState, useEffect } from "react";
import { API_BASE } from "@/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  UserCheck, 
  Clock, 
  Calendar, 
  Activity, 
  TrendingUp, 
  LogIn, 
  LogOut, 
  MapPin, 
  UsersRound 
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line, 
  Legend,
  AreaChart,
  Area
} from "recharts";

const GENDER_COLORS = ["#3b82f6", "#ec4899"]; // Blue (Pria), Pink (Wanita)

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE}/api/dashboard/stats`);
        const result = await response.json();
        if (result.success) {
          setData(result);
        }
      } catch (error) {
        console.error("Dashboard Stats Error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-muted-foreground animate-pulse text-sm">Memuat analisis dashboard...</p>
        </div>
      </div>
    );
  }

  const { stats, deptData, statusData, genderData, hourlyData, recentActivity } = data;

  const statCards = [
    { 
      label: "Total Pegawai", 
      value: stats.totalPegawai, 
      desc: `${stats.aktif} Aktif, ${stats.nonAktif} Non-Aktif`,
      icon: Users, 
      color: "text-primary bg-primary/10 border border-primary/25" 
    },
    { 
      label: "Hadir Hari Ini", 
      value: stats.hadirHariIni, 
      desc: "Status masuk/pulang",
      icon: UserCheck, 
      color: "text-success bg-success/10 border border-success/25" 
    },
    { 
      label: "Tingkat Kehadiran", 
      value: `${stats.tingkatKehadiran}%`, 
      desc: "Persentase dari pegawai aktif",
      icon: TrendingUp, 
      color: "text-info bg-info/10 border border-info/25" 
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Ringkasan data kepegawaian, kehadiran real-time, & statistik mesin</p>
        </div>
        <div className="flex items-center gap-2 bg-success/10 border border-success/20 px-3.5 py-1.5 rounded-full text-success text-xs font-semibold shadow-card animate-pulse-soft">
          <Activity className="w-3.5 h-3.5" /> Real-time Sync Active
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {statCards.map(s => (
          <Card key={s.label} className="border border-border/50 shadow-card hover:shadow-elevated hover:-translate-y-0.5 transition-all duration-200">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`p-3 rounded-2xl border ${s.color}`}>
                <s.icon className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{s.label}</p>
                <p className="text-2xl font-bold tracking-tight text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left/Middle: Bar & Line charts (Col span 2) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Hourly Attendance Area Chart */}
          <Card className="border border-border/50 shadow-card hover:shadow-elevated transition-all duration-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Clock className="w-4 h-4 text-primary" /> Peak Jam Masuk & Pulang (Hari Ini)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(221,83%,53%)" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="hsl(221,83%,53%)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }} />
                    <Area type="monotone" dataKey="count" name="Jumlah Scan" stroke="hsl(221,83%,53%)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCount)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Department Bar Chart */}
          <Card className="border border-border/50 shadow-card hover:shadow-elevated transition-all duration-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <UsersRound className="w-4 h-4 text-primary" /> Karyawan per Departemen (Top 10)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="dept" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }} />
                    <Bar dataKey="count" name="Jumlah Pegawai" fill="hsl(221,83%,53%)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Pie Donut Charts */}
        <div className="space-y-6">
          {/* Gender Donut */}
          <Card className="border border-border/50 shadow-card hover:shadow-elevated transition-all duration-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-foreground">Distribusi Gender</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center p-6 space-y-4">
              <div className="h-[150px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={genderData} 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={45} 
                      outerRadius={65} 
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {genderData.map((_: any, idx: number) => (
                        <Cell key={`cell-${idx}`} fill={GENDER_COLORS[idx % GENDER_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 text-xs font-semibold w-full border-t border-border pt-4">
                {genderData.map((d: any, idx: number) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-muted-foreground">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: GENDER_COLORS[idx] }}></div>
                    <span>{d.name} ({d.value})</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Activity Table */}
      <Card className="border border-border/50 shadow-card hover:shadow-elevated transition-all duration-200">
        <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
            <Activity className="w-4 h-4 text-success" /> Aktivitas Absensi Terbaru
          </CardTitle>
          <span className="text-[10px] bg-muted px-2.5 py-1 rounded-full font-bold uppercase text-muted-foreground tracking-wider border border-border">
            10 Logs Terakhir
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 border-b border-border">
                  <TableHead className="w-[120px] font-bold text-xs text-muted-foreground">NIK</TableHead>
                  <TableHead className="font-bold text-xs text-muted-foreground">Nama Pegawai</TableHead>
                  <TableHead className="font-bold text-xs text-muted-foreground">Departemen</TableHead>
                  <TableHead className="text-center font-bold text-xs text-muted-foreground">Waktu Tap</TableHead>
                  <TableHead className="text-center font-bold text-xs text-muted-foreground">Status</TableHead>
                  <TableHead className="text-center font-bold text-xs text-muted-foreground">Lokasi Mesin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentActivity.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                      Belum ada data tap absensi masuk hari ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  recentActivity.map((log: any) => (
                    <TableRow key={log.id} className="hover:bg-muted/10 border-b border-border transition-colors">
                      <TableCell className="font-mono text-xs font-semibold">{log.pin}</TableCell>
                      <TableCell className="font-semibold text-xs text-foreground">{log.nama}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{log.departemen}</TableCell>
                      <TableCell className="text-center text-xs font-mono">{log.waktu.split(' ')[1]}</TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant="outline" 
                          className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                            log.status === "masuk" 
                              ? "bg-success/10 text-success border-success/20" 
                              : "bg-warning/10 text-warning border-warning/20"
                          }`}
                        >
                          {log.status === "masuk" ? <LogIn className="w-2.5 h-2.5 inline mr-1" /> : <LogOut className="w-2.5 h-2.5 inline mr-1" />}
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-xs font-medium text-muted-foreground flex items-center justify-center gap-1">
                        <MapPin className="w-3 h-3 text-muted-foreground/60" /> {log.lokasi}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
