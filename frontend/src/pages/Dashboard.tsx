import { useState, useEffect } from "react";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
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
  UsersRound,
  CalendarCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  User
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
import dayjs from "dayjs";
import 'dayjs/locale/id';

dayjs.locale('id');

const GENDER_COLORS = ["#3b82f6", "#ec4899"]; // Blue (Pria), Pink (Wanita)

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await authFetch("/api/dashboard/stats");
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

  // ─────────────────────────────────────────────────────────────
  // 1. TAMPILAN KHUSUS USER BIASA (STAFF) - DASHBOARD PRIBADI
  // ─────────────────────────────────────────────────────────────
  if (data.isPersonal) {
    const { personal } = data;
    const { today, monthStats, recentActivity } = personal;

    return (
      <div className="space-y-6 animate-fade-in pb-10">
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs">
                  {user?.departemen || "Staff"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {dayjs().format('dddd, DD MMMM YYYY')}
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground mt-2">
                Selamat Datang, {user?.nama || "Karyawan"}! 👋
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Berikut adalah ringkasan kehadiran & riwayat absensi Anda di Rumah Sakit Permata Keluarga.
              </p>
            </div>
            <Button asChild className="self-start md:self-auto gap-2">
              <Link to="/absensi">
                Lihat Rekap Absensi
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* 3 Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Status Hari Ini */}
          <Card className="border border-border/60 shadow-sm">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Kehadiran Hari Ini
                </span>
                {today.status === 'LENGKAP' ? (
                  <Badge className="bg-emerald-600 text-white gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Lengkap
                  </Badge>
                ) : today.status === 'BELUM PULANG' ? (
                  <Badge className="bg-amber-600 text-white gap-1">
                    <Clock className="w-3 h-3" /> Masuk Saja
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-muted-foreground">
                    Belum Absen
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/50">
                <div>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <LogIn className="w-3.5 h-3.5 text-emerald-500" /> Jam Masuk
                  </p>
                  <p className="text-lg font-bold text-foreground mt-0.5">
                    {today.masuk || "–"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <LogOut className="w-3.5 h-3.5 text-amber-500" /> Jam Pulang
                  </p>
                  <p className="text-lg font-bold text-foreground mt-0.5">
                    {today.pulang || "–"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Hadir Bulan Ini */}
          <Card className="border border-border/60 shadow-sm">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Hari Hadir Bulan Ini
                </span>
                <p className="text-3xl font-bold text-foreground mt-2">
                  {monthStats.hariHadir} <span className="text-sm font-normal text-muted-foreground">Hari</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Bulan {dayjs().format('MMMM YYYY')}
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                <CalendarCheck className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          {/* Total Scan Bulan Ini */}
          <Card className="border border-border/60 shadow-sm">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Total Scan Mesin
                </span>
                <p className="text-3xl font-bold text-foreground mt-2">
                  {monthStats.totalScan} <span className="text-sm font-normal text-muted-foreground">Kali</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Total tap kartu / fingerprint
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 border border-indigo-200 dark:border-indigo-800">
                <Activity className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Riwayat Absensi Terakhir */}
        <Card className="border border-border/60 shadow-sm overflow-hidden">
          <CardHeader className="p-4 border-b border-border/60 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Clock className="w-4 h-4 text-primary" />
              Riwayat Tap Absensi Terakhir
            </CardTitle>
            <Button variant="ghost" size="sm" asChild className="text-xs h-8">
              <Link to="/absensi">Lihat Selengkapnya</Link>
            </Button>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-[180px]">Waktu Tap</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead>Lokasi Mesin / IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentActivity.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-28 text-center text-muted-foreground">
                      Belum ada riwayat tap absensi yang tercatat.
                    </TableCell>
                  </TableRow>
                ) : (
                  recentActivity.map((r: any) => (
                    <TableRow key={r.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs font-semibold">
                        {r.waktu}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            r.status === "masuk"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300"
                          }
                        >
                          {r.status === "masuk" ? "MASUK" : "PULANG"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                        {r.lokasi}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. TAMPILAN KHUSUS IT & HRD - DASHBOARD KOMPREHENSIF RS
  // ─────────────────────────────────────────────────────────────
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard Manajemen</h1>
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
                      <linearGradient id="colorMasuk" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="colorPulang" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} 
                    />
                    <Area type="monotone" dataKey="masuk" name="Masuk" stroke="#22c55e" strokeWidth={2} fillOpacity={1} fill="url(#colorMasuk)" />
                    <Area type="monotone" dataKey="pulang" name="Pulang" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorPulang)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Top Departments */}
          <Card className="border border-border/50 shadow-card hover:shadow-elevated transition-all duration-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <UsersRound className="w-4 h-4 text-primary" /> 10 Departemen Terbanyak
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="dept" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                    />
                    <Bar dataKey="count" name="Jumlah" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Doughnuts & Summary (Col span 1) */}
        <div className="space-y-6">
          {/* Gender Ratio */}
          <Card className="border border-border/50 shadow-card hover:shadow-elevated transition-all duration-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Users className="w-4 h-4 text-primary" /> Rasio Gender
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[140px] w-full flex items-center justify-center">
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
                      {genderData.map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={GENDER_COLORS[index % GENDER_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 text-xs text-muted-foreground mt-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]"></div>
                  <span>Pria ({genderData[0]?.value || 0})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ec4899]"></div>
                  <span>Wanita ({genderData[1]?.value || 0})</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status Pegawai */}
          <Card className="border border-border/50 shadow-card hover:shadow-elevated transition-all duration-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Activity className="w-4 h-4 text-primary" /> Status Pegawai
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[140px] w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      <Cell fill="#22c55e" />
                      <Cell fill="#ef4444" />
                      <Cell fill="#eab308" />
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 text-xs text-muted-foreground mt-2">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-[#22c55e]"></div>
                  <span>Aktif</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-[#ef4444]"></div>
                  <span>Non-Aktif</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-[#eab308]"></div>
                  <span>Cuti</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Realtime Recent Activity Feed */}
      <Card className="border border-border/50 shadow-card hover:shadow-elevated transition-all duration-200 overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border/50 pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Activity className="w-4 h-4 text-primary" /> Aktivitas Absensi Terkini
            </CardTitle>
            <p className="text-xs text-muted-foreground">Log tap kartu / sidik jari yang masuk secara real-time</p>
          </div>
          <Badge variant="outline" className="bg-background text-xs">
            10 Transaksi Terakhir
          </Badge>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border/50 bg-muted/10 text-xs">
                <TableHead className="w-[100px]">PIN / NIK</TableHead>
                <TableHead>Nama Karyawan</TableHead>
                <TableHead>Departemen</TableHead>
                <TableHead>Waktu Log</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Mesin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-xs">
              {recentActivity.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                    Belum ada aktivitas transaksi absensi hari ini.
                  </TableCell>
                </TableRow>
              ) : (
                recentActivity.map((r: any) => (
                  <TableRow key={r.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="font-mono font-medium">{r.pin}</TableCell>
                    <TableCell className="font-semibold text-foreground">{r.nama}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        {r.departemen}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">{r.waktu}</TableCell>
                    <TableCell>
                      <Badge 
                        className={`text-[10px] uppercase font-bold tracking-wider ${
                          r.status === 'masuk' 
                            ? 'bg-success/15 text-success hover:bg-success/20 border-success/30' 
                            : 'bg-warning/15 text-warning hover:bg-warning/20 border-warning/30'
                        }`}
                        variant="outline"
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-primary" /> {r.lokasi}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
