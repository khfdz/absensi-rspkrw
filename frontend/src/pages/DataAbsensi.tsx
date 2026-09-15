import { useState, useEffect, useMemo, useCallback } from "react";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search, Calendar, Filter, Download, User,
  Building, LogIn, LogOut, MapPin, ListCollapse,
  Clock, CalendarDays, RefreshCw, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';

interface AbsensiRaw {
  id: number;
  pin: string;
  nama_karyawan: string;
  departemen: string;
  waktu: string;
  status: string;
  device_id: string | null;
  created_at: string;
}

interface RekapHarian {
  pin: string;
  nama: string;
  departemen: string;
  tanggal: string;
  jam_masuk: string | null;
  jam_pulang: string | null;
  tgl_pulang: string | null;
  total_scan: number;
  lokasi: string;
  status: 'LENGKAP' | 'LUPA_PULANG' | 'LUPA_MASUK';
}

export default function DataAbsensi() {
  const { user } = useAuth();
  const userRole = (user?.role || "STAFF") as "IT" | "HRD" | "STAFF";
  const isPrivileged = userRole === "IT" || userRole === "HRD";

  const [activeTab, setActiveTab] = useState("rekap");

  // States for Tab 1: Rekap Harian (Rentang Waktu)
  const [rekapStartDate, setRekapStartDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [rekapEndDate, setRekapEndDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [rekapData, setRekapData] = useState<RekapHarian[]>([]);
  const [rekapLoading, setRekapLoading] = useState(false);
  const [rekapSearch, setRekapSearch] = useState("");
  const [rekapStatusFilter, setRekapStatusFilter] = useState("all");

  // States for Tab 2: Log Transaksi
  const [logStartDate, setLogStartDate] = useState(dayjs().subtract(1, 'day').format('YYYY-MM-DD'));
  const [logEndDate, setLogEndDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [logSearch, setLogSearch] = useState("");
  const [logStatusFilter, setLogStatusFilter] = useState("all");
  const [logData, setLogData] = useState<AbsensiRaw[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logPage, setLogPage] = useState(1);
  const [logTotalPages, setLogTotalPages] = useState(1);
  const [logTotalItems, setLogTotalItems] = useState(0);

  // Fetch Rekap Harian
  const fetchRekap = useCallback(async () => {
    try {
      setRekapLoading(true);
      const res = await authFetch(`/api/absensi/rekap?startDate=${rekapStartDate}&endDate=${rekapEndDate}`);
      const json = await res.json();
      if (json.success) {
        setRekapData(json.data || []);
      } else {
        toast.error("Gagal memuat rekap absensi");
      }
    } catch (err) {
      console.error(err);
      toast.error("Gagal menghubungkan ke server");
    } finally {
      setRekapLoading(false);
    }
  }, [rekapStartDate, rekapEndDate]);

  // Fetch Log Transaksi
  const fetchLogs = useCallback(async () => {
    try {
      setLogLoading(true);
      const params = new URLSearchParams({
        startDate: logStartDate,
        endDate: logEndDate,
        page: String(logPage),
        limit: "100",
      });
      if (isPrivileged && logSearch.trim()) {
        params.append("pin", logSearch.trim());
      }
      if (logStatusFilter !== "all") params.append("status", logStatusFilter);

      const res = await authFetch(`/api/absensi?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setLogData(json.data || []);
        setLogTotalPages(json.pagination?.total_pages || 1);
        setLogTotalItems(json.pagination?.total || 0);
      } else {
        toast.error("Gagal memuat log transaksi");
      }
    } catch (err) {
      console.error(err);
      toast.error("Gagal menghubungkan ke server");
    } finally {
      setLogLoading(false);
    }
  }, [logStartDate, logEndDate, logPage, logSearch, logStatusFilter, isPrivileged]);

  // Trigger Fetching
  useEffect(() => {
    if (activeTab === "rekap") {
      fetchRekap();
    } else {
      fetchLogs();
    }
  }, [activeTab, fetchRekap, fetchLogs]);

  // Local filtering for Rekap Harian (by search input & status badge)
  const processedRekap = useMemo(() => {
    return rekapData.filter(item => {
      const matchesSearch =
        item.pin.toLowerCase().includes(rekapSearch.toLowerCase()) ||
        item.nama.toLowerCase().includes(rekapSearch.toLowerCase()) ||
        (item.departemen && item.departemen.toLowerCase().includes(rekapSearch.toLowerCase()));

      const matchesStatus =
        rekapStatusFilter === "all" ||
        item.status.toLowerCase() === rekapStatusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [rekapData, rekapSearch, rekapStatusFilter]);

  // Export Rekap to Excel
  const exportRekapExcel = () => {
    if (processedRekap.length === 0) {
      toast.error("Tidak ada data rekap untuk diekspor");
      return;
    }
    const exportRows = processedRekap.map((r, idx) => ({
      'No': idx + 1,
      'NIK': r.pin,
      'Nama Karyawan': r.nama,
      'Departemen': r.departemen,
      'Tanggal': r.tanggal,
      'Jam Masuk': r.jam_masuk || '-',
      'Jam Pulang': r.jam_pulang || '-',
      'Device/Lokasi': r.lokasi || '-',
      'Status': r.status
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    const sheetTitle = rekapStartDate === rekapEndDate ? `Rekap ${rekapStartDate}` : `Rekap ${rekapStartDate} sd ${rekapEndDate}`;
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetTitle.substring(0, 31));

    // Formatting widths
    worksheet['!cols'] = [{ wch: 6 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 15 }];

    const fileName = rekapStartDate === rekapEndDate
      ? `Rekap_Absensi_${rekapStartDate}.xlsx`
      : `Rekap_Absensi_${rekapStartDate}_sd_${rekapEndDate}.xlsx`;

    XLSX.writeFile(workbook, fileName);
    toast.success("Rekap Absensi berhasil diekspor");
  };

  // Export Logs to Excel
  const exportLogsExcel = async () => {
    try {
      // Fetch all matching logs instead of current page for export
      const params = new URLSearchParams({
        startDate: logStartDate,
        endDate: logEndDate,
        page: "1",
        limit: "10000" // high limit to fetch all
      });
      if (isPrivileged && logSearch.trim()) params.append("pin", logSearch.trim());
      if (logStatusFilter !== "all") params.append("status", logStatusFilter);

      const res = await authFetch(`/api/absensi?${params.toString()}`);
      const json = await res.json();
      if (!json.success || !json.data.length) {
        toast.error("Tidak ada data log untuk diekspor");
        return;
      }

      const exportRows = json.data.map((r: AbsensiRaw, idx: number) => ({
        'No': idx + 1,
        'NIK': r.pin,
        'Nama Karyawan': r.nama_karyawan,
        'Departemen': r.departemen,
        'Waktu Scan': r.waktu,
        'Status': r.status.toUpperCase(),
        'IP Source': r.device_id || '-'
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Log Absensi");

      worksheet['!cols'] = [{ wch: 6 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 25 }, { wch: 12 }, { wch: 18 }];

      XLSX.writeFile(workbook, `Log_Absensi_${logStartDate}_to_${logEndDate}.xlsx`);
      toast.success("Log Transaksi berhasil diekspor");
    } catch {
      toast.error("Gagal mengekspor log");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ListCollapse className="w-6 h-6 text-primary animate-scale-in" />
            Data Absensi
          </h1>
          <p className="text-muted-foreground text-sm font-medium">Monitoring kehadiran karyawan dan log transaksi mesin.</p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "rekap" ? (
            <Button
              onClick={exportRekapExcel}
              className="gap-2 bg-success text-success-foreground hover:opacity-90 transition-all rounded-2xl font-bold shadow-card h-11 px-5"
              disabled={rekapLoading || processedRekap.length === 0}
            >
              <Download className="w-4 h-4" />
              Export Rekap Excel
            </Button>
          ) : (
            <Button
              onClick={exportLogsExcel}
              className="gap-2 bg-success text-success-foreground hover:opacity-90 transition-all rounded-2xl font-bold shadow-card h-11 px-5"
              disabled={logLoading || logData.length === 0}
            >
              <Download className="w-4 h-4" />
              Export Log Excel
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={activeTab === "rekap" ? fetchRekap : fetchLogs}
            disabled={rekapLoading || logLoading}
            className="bg-card border border-border hover:bg-accent hover:shadow-elevated h-11 w-11 rounded-2xl transition-all duration-200 flex items-center justify-center"
          >
            <RefreshCw className={`w-4 h-4 text-muted-foreground ${(rekapLoading || logLoading) ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {!isPrivileged && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-sm text-primary flex items-center gap-2.5 animate-fade-in">
          <User className="w-4 h-4 shrink-0" />
          <span>
            Mode Pribadi: Menampilkan data absensi Anda (<strong>{user?.nama || "Karyawan"}</strong> • NIK: {user?.nik}).
          </span>
        </div>
      )}

      {/* Tabs list selector */}
      <Tabs defaultValue="rekap" onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 max-w-[400px] border border-border p-1 bg-muted rounded-2xl h-12">
          <TabsTrigger value="rekap" className="rounded-xl font-semibold text-sm data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-card transition-all duration-200">
            Rekap Harian
          </TabsTrigger>
          <TabsTrigger value="log" className="rounded-xl font-semibold text-sm data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-card transition-all duration-200">
            Log Mesin Absensi
          </TabsTrigger>
        </TabsList>

        {/* ─── TAB 1: REKAP HARIAN ─── */}
        <TabsContent value="rekap" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="space-y-3 bg-card p-4 rounded-2xl border border-border shadow-card hover:shadow-elevated transition-all duration-200 animate-slide-up">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-3 space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Dari Tanggal</label>
                <div className="relative">
                  <CalendarDays className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type="date"
                    value={rekapStartDate}
                    onChange={e => setRekapStartDate(e.target.value)}
                    className="pl-11 h-11 border-border focus:ring-ring bg-background"
                  />
                </div>
              </div>

              <div className="md:col-span-3 space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Sampai Tanggal</label>
                <div className="relative">
                  <CalendarDays className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type="date"
                    value={rekapEndDate}
                    onChange={e => setRekapEndDate(e.target.value)}
                    className="pl-11 h-11 border-border focus:ring-ring bg-background"
                  />
                </div>
              </div>

              <div className="md:col-span-3 space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Cari Pegawai</label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder={isPrivileged ? "Cari NIK, Nama, atau Departemen..." : `${user?.nama || ""} (${user?.nik || ""})`}
                    value={isPrivileged ? rekapSearch : `${user?.nama || ""} (${user?.nik || ""})`}
                    onChange={e => isPrivileged && setRekapSearch(e.target.value)}
                    disabled={!isPrivileged}
                    className="pl-11 h-11 border-border focus:ring-ring bg-background"
                  />
                </div>
              </div>

              <div className="md:col-span-3 space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Status Kehadiran</label>
                <div className="flex items-center gap-2">
                  <Select value={rekapStatusFilter} onValueChange={setRekapStatusFilter}>
                    <SelectTrigger className="h-11 border-border rounded-2xl focus:ring-ring bg-background">
                      <SelectValue placeholder="Pilih Status" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-border shadow-float">
                      <SelectItem value="all">Semua Status</SelectItem>
                      <SelectItem value="lengkap">Lengkap</SelectItem>
                      <SelectItem value="lupa_pulang">Lupa Pulang</SelectItem>
                      <SelectItem value="lupa_masuk">Lupa Masuk</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    onClick={() => fetchRekap()}
                    disabled={rekapLoading}
                    className="h-11 px-4 rounded-2xl font-bold bg-primary text-primary-foreground shrink-0 gap-1.5"
                    title="Muat Ulang Rekap"
                  >
                    <RefreshCw className={`w-4 h-4 ${rekapLoading ? 'animate-spin' : ''}`} />
                    <span>Tampilkan</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Quick Presets Rentang Tanggal */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/50 text-xs">
              <span className="text-muted-foreground font-semibold mr-1">Preset Cepat:</span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs rounded-lg px-2.5 bg-background border-border hover:bg-primary/10 hover:text-primary"
                onClick={() => {
                  const today = dayjs().format('YYYY-MM-DD');
                  setRekapStartDate(today);
                  setRekapEndDate(today);
                }}
              >
                Hari Ini
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs rounded-lg px-2.5 bg-background border-border hover:bg-primary/10 hover:text-primary"
                onClick={() => {
                  setRekapStartDate(dayjs().subtract(7, 'day').format('YYYY-MM-DD'));
                  setRekapEndDate(dayjs().format('YYYY-MM-DD'));
                }}
              >
                7 Hari Terakhir
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs rounded-lg px-2.5 bg-background border-border hover:bg-primary/10 hover:text-primary"
                onClick={() => {
                  setRekapStartDate(dayjs().startOf('month').format('YYYY-MM-DD'));
                  setRekapEndDate(dayjs().format('YYYY-MM-DD'));
                }}
              >
                Bulan Ini
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs rounded-lg px-2.5 bg-background border-border hover:bg-primary/10 hover:text-primary"
                onClick={() => {
                  const now = dayjs();
                  const start = now.subtract(1, 'month').date(21).format('YYYY-MM-DD');
                  const end = now.date(25).format('YYYY-MM-DD');
                  setRekapStartDate(start);
                  setRekapEndDate(end);
                }}
              >
                Periode Cutoff (21 - 25)
              </Button>
            </div>
          </div>

          {/* Table Card */}
          <Card className="bg-card rounded-2xl border border-border shadow-card hover:shadow-elevated transition-all duration-200 overflow-hidden animate-slide-up">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30 border-b border-border">
                    <TableRow>
                      <TableHead className="w-12 font-bold text-xs text-muted-foreground">No</TableHead>
                      <TableHead className="w-28 font-bold text-xs text-muted-foreground">NIK</TableHead>
                      <TableHead className="font-bold text-xs text-muted-foreground">Nama Pegawai</TableHead>
                      <TableHead className="font-bold text-xs text-muted-foreground">Departemen</TableHead>
                      <TableHead className="text-center w-28 font-bold text-xs text-muted-foreground">Tanggal</TableHead>
                      <TableHead className="text-center w-28 font-bold text-xs text-muted-foreground">Jam Masuk</TableHead>
                      <TableHead className="text-center w-28 font-bold text-xs text-muted-foreground">Jam Pulang</TableHead>
                      <TableHead className="text-center w-36 font-bold text-xs text-muted-foreground">Device/Lokasi</TableHead>
                      <TableHead className="text-center w-36 font-bold text-xs text-muted-foreground">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rekapLoading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <TableRow key={i} className="border-b border-border">
                          {Array.from({ length: 9 }).map((_, j) => (
                            <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded"></div></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : processedRekap.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                          {rekapSearch || rekapStatusFilter !== 'all' ? "Data filter tidak ditemukan." : "Tidak ada data absensi untuk rentang tanggal ini."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      processedRekap.map((row, idx) => (
                        <TableRow key={`${row.pin}-${row.tanggal}-${idx}`} className="hover:bg-muted/10 border-b border-border transition-colors">
                          <TableCell className="text-muted-foreground text-[11px] font-medium">{idx + 1}</TableCell>
                          <TableCell>
                            <span className="font-mono text-xs font-bold text-foreground bg-muted px-2 py-0.5 rounded-lg border border-border">{row.pin}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-primary" />
                              <span className="font-semibold text-foreground text-xs">{row.nama}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building className="w-3.5 h-3.5 text-muted-foreground/60" />
                              <span className="text-xs text-muted-foreground font-medium">{row.departemen}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-mono text-xs font-semibold text-foreground/80">{row.tanggal}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            {row.jam_masuk ? (
                              <span className="font-bold text-primary text-xs font-mono">{row.jam_masuk}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground/60 italic">–</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {row.jam_pulang ? (
                              <span className="font-bold text-warning text-xs font-mono">
                                {row.jam_pulang}
                                {row.tgl_pulang && row.tgl_pulang !== row.tanggal && (
                                  <span className="text-[10px] text-muted-foreground block font-normal">({row.tgl_pulang})</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground/60 italic">–</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs font-medium">
                              <MapPin className="w-3 h-3 text-muted-foreground/55" />
                              {row.lokasi}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${row.status === "LENGKAP"
                                ? "bg-success/10 text-success border-success/20"
                                : row.status === "LUPA_PULANG"
                                  ? "bg-warning/10 text-warning border-warning/20"
                                  : "bg-destructive/10 text-destructive border border-destructive/20"
                                }`}
                            >
                              {row.status === "LENGKAP" && <LogIn className="w-2.5 h-2.5 inline mr-1" />}
                              {row.status !== "LENGKAP" && <AlertTriangle className="w-2.5 h-2.5 inline mr-1" />}
                              {row.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB 2: LOG TRANSAKSI ─── */}
        <TabsContent value="log" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-card p-4 rounded-2xl border border-border shadow-card hover:shadow-elevated transition-all duration-200 items-end animate-slide-up">
            {/* Start Date */}
            <div className="md:col-span-3 space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Dari Tanggal</label>
              <div className="relative">
                <CalendarDays className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={logStartDate}
                  onChange={e => { setLogStartDate(e.target.value); setLogPage(1); }}
                  className="pl-11 h-11 border-border focus:ring-ring"
                />
              </div>
            </div>

            {/* End Date */}
            <div className="md:col-span-3 space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Sampai Tanggal</label>
              <div className="relative">
                <CalendarDays className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={logEndDate}
                  onChange={e => { setLogEndDate(e.target.value); setLogPage(1); }}
                  className="pl-11 h-11 border-border focus:ring-ring"
                />
              </div>
            </div>

            {/* Search NIK/Name */}
            <div className="md:col-span-3 space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Cari NIK / Nama</label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={isPrivileged ? "Ketik NIK..." : `${user?.nama || ""} (${user?.nik || ""})`}
                  value={isPrivileged ? logSearch : `${user?.nama || ""} (${user?.nik || ""})`}
                  onChange={e => { if (isPrivileged) { setLogSearch(e.target.value); setLogPage(1); } }}
                  disabled={!isPrivileged}
                  className="pl-11 h-11 border-border focus:ring-ring"
                />
              </div>
            </div>

            {/* Status Type */}
            <div className="md:col-span-3 space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Status Scan</label>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
                <Select value={logStatusFilter} onValueChange={val => { setLogStatusFilter(val); setLogPage(1); }}>
                  <SelectTrigger className="h-11 border-border rounded-2xl focus:ring-ring">
                    <SelectValue placeholder="Semua" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-border shadow-float">
                    <SelectItem value="all">Semua Scan</SelectItem>
                    <SelectItem value="masuk">Masuk</SelectItem>
                    <SelectItem value="pulang">Pulang</SelectItem>
                    {/* <SelectItem value="lembur_masuk">Lembur Masuk</SelectItem>
                    <SelectItem value="lembur_pulang">Lembur Pulang</SelectItem> */}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Table Card */}
          <Card className="bg-card rounded-2xl border border-border shadow-card hover:shadow-elevated transition-all duration-200 overflow-hidden animate-slide-up">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30 border-b border-border">
                    <TableRow>
                      <TableHead className="w-12 font-bold text-xs text-muted-foreground">No</TableHead>
                      <TableHead className="w-32 font-bold text-xs text-muted-foreground">NIK</TableHead>
                      <TableHead className="font-bold text-xs text-muted-foreground">Nama Karyawan</TableHead>
                      <TableHead className="font-bold text-xs text-muted-foreground">Departemen</TableHead>
                      <TableHead className="text-center w-48 font-bold text-xs text-muted-foreground">Waktu Scan</TableHead>
                      <TableHead className="text-center w-36 font-bold text-xs text-muted-foreground">Status</TableHead>
                      <TableHead className="text-center w-40 font-bold text-xs text-muted-foreground">Device Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logLoading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <TableRow key={i} className="border-b border-border">
                          {Array.from({ length: 7 }).map((_, j) => (
                            <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded"></div></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : logData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                          Data log absensi tidak ditemukan.
                        </TableCell>
                      </TableRow>
                    ) : (
                      logData.map((row, idx) => (
                        <TableRow key={row.id} className="hover:bg-muted/10 border-b border-border transition-colors">
                          <TableCell className="text-muted-foreground text-[11px] font-medium">{(logPage - 1) * 100 + idx + 1}</TableCell>
                          <TableCell>
                            <span className="font-mono text-xs font-bold text-foreground bg-muted px-2 py-0.5 rounded-lg border border-border">{row.pin}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-primary" />
                              <span className="font-semibold text-foreground text-xs">{row.nama_karyawan}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building className="w-3.5 h-3.5 text-muted-foreground/60" />
                              <span className="text-xs text-muted-foreground font-medium">{row.departemen}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs font-semibold text-foreground">
                            {row.waktu}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${row.status.includes("masuk")
                                ? "bg-success/10 text-success border-success/20"
                                : "bg-warning/10 text-warning border-warning/20"
                                }`}
                            >
                              {row.status.includes("masuk") ? <LogIn className="w-2.5 h-2.5 inline mr-1" /> : <LogOut className="w-2.5 h-2.5 inline mr-1" />}
                              {row.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs font-medium">
                              <MapPin className="w-3 h-3 text-muted-foreground/55" />
                              {row.device_id || '-'}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination controls */}
              {logTotalPages > 1 && (
                <div className="p-4 border-t border-border flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Menampilkan <strong>{logData.length}</strong> dari <strong>{logTotalItems}</strong> data
                  </span>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLogPage(prev => Math.max(prev - 1, 1))}
                      disabled={logPage === 1 || logLoading}
                      className="h-9 rounded-xl text-xs"
                    >
                      Sebelumnya
                    </Button>
                    <span className="text-xs font-bold px-3 text-foreground">
                      Halaman {logPage} / {logTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLogPage(prev => Math.min(prev + 1, logTotalPages))}
                      disabled={logPage === logTotalPages || logLoading}
                      className="h-9 rounded-xl text-xs"
                    >
                      Selanjutnya
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
