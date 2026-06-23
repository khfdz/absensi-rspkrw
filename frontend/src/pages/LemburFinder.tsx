import { useState, useCallback } from "react";
import { API_BASE } from "@/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Clock, CalendarDays, AlertTriangle, TrendingUp, User, Timer, PhoneCall, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import dayjs from "dayjs";

// ─── Types ──────────────────────────────────────────────────────────────────
interface DailyEntry {
  tanggal: string;
  hari: string;
  jam_masuk: string | null;
  jam_pulang: string | null;
  shift_label: string;
  shift_mulai: string | null;
  shift_selesai: string | null;
  tipe: "NORMAL" | "LEMBUR" | "ON-CALL" | "TIDAK_LENGKAP";
  durasi_menit: number;
  detail: string;
}

interface PegawaiResult {
  pin: string;
  nama: string;
  departemen: string;
  daily: DailyEntry[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatDurasi(menit: number): string {
  if (menit <= 0) return "–";
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  if (jam > 0 && sisa > 0) return `${jam}j ${sisa}m`;
  if (jam > 0) return `${jam} jam`;
  return `${sisa} menit`;
}

// Default date range: 25th of last month to 25th of this month
function getDefaultDates() {
  const today = dayjs();
  const day25ThisMonth = today.date(25);
  const start = day25ThisMonth.subtract(1, "month").format("YYYY-MM-DD");
  const end = day25ThisMonth.format("YYYY-MM-DD");
  return { start, end };
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function LemburFinder() {
  const { toast } = useToast();
  const defaults = getDefaultDates();

  const [nama, setNama] = useState("");
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PegawaiResult[]>([]);
  const [selectedPin, setSelectedPin] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!nama.trim()) {
      toast({ title: "Peringatan", description: "Masukkan nama pegawai terlebih dahulu.", variant: "destructive" });
      return;
    }
    if (!startDate || !endDate) {
      toast({ title: "Peringatan", description: "Rentang tanggal harus diisi.", variant: "destructive" });
      return;
    }
    try {
      setLoading(true);
      setResults([]);
      setSelectedPin(null);
      setHasSearched(true);
      const res = await fetch(
        `${API_BASE}/api/absensi/lembur-finder?nama=${encodeURIComponent(nama.trim())}&startDate=${startDate}&endDate=${endDate}`
      );
      const json = await res.json();
      if (json.success) {
        setResults(json.data || []);
        if ((json.data || []).length === 1) setSelectedPin(json.data[0].pin);
        if ((json.data || []).length === 0) {
          toast({ title: "Tidak Ditemukan", description: `Pegawai "${nama}" tidak ditemukan di database.` });
        }
      } else {
        toast({ title: "Error", description: json.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Gagal", description: "Tidak bisa terhubung ke server.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [nama, startDate, endDate, toast]);

  const selectedPegawai = results.find(r => r.pin === selectedPin) ?? null;

  // Summary stats
  const summary = selectedPegawai
    ? selectedPegawai.daily.reduce(
        (acc, d) => {
          if (d.tipe === "LEMBUR") {
            acc.totalLemburMenit += d.durasi_menit;
            acc.hariLembur++;
          } else if (d.tipe === "ON-CALL") {
            acc.totalOnCallMenit += d.durasi_menit;
            acc.hariOnCall++;
          }
          return acc;
        },
        { totalLemburMenit: 0, hariLembur: 0, totalOnCallMenit: 0, hariOnCall: 0 }
      )
    : null;

  const exportCSV = () => {
    if (!selectedPegawai) return;
    const headers = "Tanggal,Hari,Jam Masuk,Jam Pulang,Shift,Tipe,Durasi,Keterangan\n";
    const rows = selectedPegawai.daily
      .filter(d => d.tipe !== "NORMAL")
      .map(d =>
        `${d.tanggal},${d.hari},${d.jam_masuk || "-"},${d.jam_pulang || "-"},${d.shift_label},${d.tipe},${formatDurasi(d.durasi_menit)},"${d.detail}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lembur_finder_${selectedPegawai.nama.replace(/\s+/g, "_")}_${startDate}_${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "Berhasil", description: "Data lembur berhasil diexport." });
  };

  // Badge per tipe
  const tipeBadge = (tipe: DailyEntry["tipe"]) => {
    switch (tipe) {
      case "LEMBUR":
        return (
          <Badge variant="outline" className="bg-warning/10 text-warning border border-warning/20 font-bold text-[10px] tracking-wider rounded-full px-2.5 py-0.5 gap-1.5 shadow-sm inline-flex items-center">
            <TrendingUp className="w-3 h-3" /> LEMBUR
          </Badge>
        );
      case "ON-CALL":
        return (
          <Badge variant="outline" className="bg-info/10 text-info border border-info/20 font-bold text-[10px] tracking-wider rounded-full px-2.5 py-0.5 gap-1.5 shadow-sm inline-flex items-center">
            <PhoneCall className="w-3 h-3" /> ON-CALL
          </Badge>
        );
      case "TIDAK_LENGKAP":
        return (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border border-destructive/20 font-bold text-[10px] tracking-wider rounded-full px-2.5 py-0.5 gap-1.5 shadow-sm inline-flex items-center">
            <AlertTriangle className="w-3 h-3" /> TIDAK LENGKAP
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-success/10 text-success border border-success/20 font-bold text-[10px] tracking-wider rounded-full px-2.5 py-0.5 shadow-sm inline-flex items-center">
            NORMAL
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Timer className="w-6 h-6 text-primary animate-scale-in" />
            Lembur Finder
          </h1>
          <p className="text-muted-foreground text-sm font-medium mt-0.5">
            Temukan rekap lembur &amp; on-call pegawai dalam rentang tanggal tertentu
          </p>
        </div>
        {selectedPegawai && (
          <Button onClick={exportCSV} className="gap-2 bg-card border border-border hover:bg-accent hover:shadow-elevated rounded-2xl h-11 px-5 font-bold transition-all duration-200 shadow-card">
            <Download className="w-4 h-4 text-muted-foreground" /> Export CSV
          </Button>
        )}
      </div>

      {/* ── Search Panel ── */}
      <Card className="bg-card rounded-2xl border border-border shadow-card hover:shadow-elevated transition-all duration-200 overflow-hidden animate-slide-up">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
            <Search className="w-4 h-4 text-primary" />
            Parameter Pencarian
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            {/* Nama */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Nama Pegawai
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="lf-nama"
                  placeholder="Contoh: Dhika Hafidz"
                  value={nama}
                  onChange={e => setNama(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSearch()}
                  className="pl-11 h-11 border-border focus:ring-ring"
                />
              </div>
            </div>

            {/* Start Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Dari Tanggal
              </label>
              <div className="relative">
                <CalendarDays className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="lf-start"
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="pl-11 h-11 border-border focus:ring-ring"
                />
              </div>
            </div>

            {/* End Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Sampai Tanggal
              </label>
              <div className="relative">
                <CalendarDays className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="lf-end"
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="pl-11 h-11 border-border focus:ring-ring"
                />
              </div>
            </div>
          </div>

          {/* Shift Info */}
          <div className="mt-4 p-4 bg-muted rounded-2xl border border-border text-xs text-muted-foreground flex items-start gap-2.5">
            <Clock className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
            <div className="leading-normal">
              <p className="font-semibold text-foreground">Jadwal Shift IT: <span className="font-normal text-muted-foreground">Senin–Jumat 08:00–16:00 &middot; Sabtu 08:00–13:00 &middot; Minggu Libur</span></p>
              <p className="mt-1 text-[11px] text-muted-foreground/80">Lembur = kerja melewati jam selesai shift &nbsp;&middot;&nbsp; On-Call = absensi di luar waktu shift / hari Minggu</p>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              id="lf-search-btn"
              onClick={handleSearch}
              disabled={loading}
              className="gap-2 bg-primary text-primary-foreground hover:opacity-90 transition-all rounded-2xl font-bold shadow-card h-11 px-6 min-w-[140px]"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              {loading ? "Mencari..." : "Cari Lembur"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Multiple results: pilih pegawai ── */}
      {results.length > 1 && (
        <Card className="bg-card rounded-2xl border border-border shadow-card hover:shadow-elevated transition-all duration-200 overflow-hidden animate-slide-up">
          <CardHeader className="pb-2 border-b border-border">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Ditemukan {results.length} pegawai — pilih salah satu:
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="flex flex-wrap gap-2">
              {results.map(r => (
                <Button
                  key={r.pin}
                  variant={selectedPin === r.pin ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedPin(r.pin)}
                  className="gap-1.5 rounded-xl h-9 text-xs"
                >
                  <User className="w-3.5 h-3.5" />
                  {r.nama}
                  <span className="text-[10px] opacity-75">({r.departemen})</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Summary Cards ── */}
      {selectedPegawai && summary && (
        <>
          {/* Info pegawai */}
          <div className="flex items-center gap-3 px-1 animate-slide-up">
            <div className="w-10 h-10 rounded-2xl bg-gradient-primary flex items-center justify-center text-white font-bold text-sm shadow-card">
              {selectedPegawai.nama.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-base leading-tight text-foreground">{selectedPegawai.nama}</p>
              <p className="text-xs text-muted-foreground font-semibold">{selectedPegawai.departemen} &bull; NIK: {selectedPegawai.pin}</p>
            </div>
            <div className="ml-auto text-xs text-muted-foreground font-medium">
              Periode: <strong>{startDate}</strong> s/d <strong>{endDate}</strong>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up">
            <Card className="border-warning/20 bg-warning/5 shadow-card hover:shadow-elevated transition-all duration-200">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-warning" />
                  <span className="text-[10px] font-bold text-warning uppercase tracking-wider">Total Lembur</span>
                </div>
                <p className="text-2xl font-bold text-warning">{formatDurasi(summary.totalLemburMenit)}</p>
                <p className="text-[11px] font-medium text-warning/80">{summary.hariLembur} hari lembur</p>
              </CardContent>
            </Card>

            <Card className="border-info/20 bg-info/5 shadow-card hover:shadow-elevated transition-all duration-200">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <PhoneCall className="w-4 h-4 text-info" />
                  <span className="text-[10px] font-bold text-info uppercase tracking-wider">Total On-Call</span>
                </div>
                <p className="text-2xl font-bold text-info">{formatDurasi(summary.totalOnCallMenit)}</p>
                <p className="text-[11px] font-medium text-info/80">{summary.hariOnCall} hari on-call</p>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/5 shadow-card hover:shadow-elevated transition-all duration-200">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Jam Lembur (Rata²)</span>
                </div>
                <p className="text-2xl font-bold text-primary">
                  {summary.hariLembur > 0
                    ? formatDurasi(Math.round(summary.totalLemburMenit / summary.hariLembur))
                    : "–"}
                </p>
                <p className="text-[11px] font-medium text-primary/80">per hari lembur</p>
              </CardContent>
            </Card>

            <Card className="border-border bg-muted/30 shadow-card hover:shadow-elevated transition-all duration-200">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <CalendarDays className="w-4 h-4 text-muted-foreground" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Kejadian</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {summary.hariLembur + summary.hariOnCall}
                </p>
                <p className="text-[11px] font-medium text-muted-foreground">lembur + on-call</p>
              </CardContent>
            </Card>
          </div>

          {/* ── Detail Table ── */}
          <Card className="bg-card rounded-2xl border border-border shadow-card hover:shadow-elevated transition-all duration-200 overflow-hidden animate-slide-up">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-foreground">Detail Harian — Lembur &amp; On-Call</CardTitle>
                <div className="flex gap-3.5 text-[10px] font-bold uppercase tracking-wider">
                  <span className="flex items-center gap-1.5 text-warning">
                    <span className="w-2 h-2 rounded-full bg-warning inline-block" /> Lembur
                  </span>
                  <span className="flex items-center gap-1.5 text-info">
                    <span className="w-2 h-2 rounded-full bg-info inline-block" /> On-Call
                  </span>
                  <span className="flex items-center gap-1.5 text-success">
                    <span className="w-2 h-2 rounded-full bg-success inline-block" /> Normal
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30 border-b border-border">
                    <TableRow>
                      <TableHead className="w-[110px] font-bold text-xs text-muted-foreground">Tanggal</TableHead>
                      <TableHead className="w-[90px] font-bold text-xs text-muted-foreground">Hari</TableHead>
                      <TableHead className="text-center font-bold text-xs text-muted-foreground">Shift</TableHead>
                      <TableHead className="text-center font-bold text-xs text-muted-foreground">Masuk</TableHead>
                      <TableHead className="text-center font-bold text-xs text-muted-foreground">Pulang</TableHead>
                      <TableHead className="text-center font-bold text-xs text-muted-foreground">Tipe</TableHead>
                      <TableHead className="text-center font-bold text-xs text-muted-foreground">Durasi</TableHead>
                      <TableHead className="font-bold text-xs text-muted-foreground">Keterangan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPegawai.daily.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                          Tidak ada data absensi ditemukan dalam periode ini.
                        </TableCell>
                      </TableRow>
                    ) : (
                      selectedPegawai.daily.map((d, idx) => {
                        return (
                          <TableRow
                            key={`${d.tanggal}-${idx}`}
                            className={`border-b border-border/40 transition-colors ${
                              d.tipe === "LEMBUR"
                                ? "bg-warning/5 hover:bg-warning/10"
                                : d.tipe === "ON-CALL"
                                ? "bg-info/5 hover:bg-info/10"
                                : d.tipe === "TIDAK_LENGKAP"
                                ? "bg-destructive/5 hover:bg-destructive/10"
                                : "hover:bg-muted/10"
                            }`}
                          >
                            <TableCell className="font-mono text-xs font-semibold text-foreground">{d.tanggal}</TableCell>
                            <TableCell>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  d.hari === "Minggu"
                                    ? "bg-destructive/10 text-destructive border-destructive/20"
                                    : d.hari === "Sabtu"
                                    ? "bg-primary/10 text-primary border-primary/20"
                                    : "bg-muted text-muted-foreground border-border"
                                }`}
                              >
                                {d.hari}
                              </span>
                            </TableCell>
                            <TableCell className="text-center text-xs text-muted-foreground font-semibold">
                              {d.shift_mulai && d.shift_selesai
                                ? `${d.shift_mulai}–${d.shift_selesai}`
                                : <span className="italic font-normal opacity-60">Libur</span>}
                            </TableCell>
                            <TableCell className="text-center">
                              {d.jam_masuk ? (
                                <span className="font-bold text-primary text-xs font-mono">{d.jam_masuk}</span>
                              ) : (
                                <span className="text-xs text-muted-foreground/60 italic">–</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {d.jam_pulang ? (
                                <span
                                  className={`font-bold text-xs font-mono ${
                                    d.tipe === "LEMBUR" ? "text-warning" : "text-foreground"
                                  }`}
                                >
                                  {d.jam_pulang}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground/60 italic">–</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">{tipeBadge(d.tipe)}</TableCell>
                            <TableCell className="text-center">
                              {d.durasi_menit > 0 ? (
                                <span
                                  className={`font-bold text-xs ${
                                    d.tipe === "LEMBUR"
                                      ? "text-warning"
                                      : d.tipe === "ON-CALL"
                                      ? "text-info"
                                      : "text-foreground"
                                  }`}
                                >
                                  {formatDurasi(d.durasi_menit)}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground/60">–</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[200px] font-medium">
                              {d.detail || "–"}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <p className="text-xs text-muted-foreground text-center pb-2 font-medium">
            Hanya menampilkan hari dengan data absensi &bull; Total baris: {selectedPegawai.daily.length}
          </p>
        </>
      )}

      {/* Empty state setelah search */}
      {hasSearched && !loading && results.length === 0 && (
        <Card className="bg-card rounded-2xl border border-border shadow-card hover:shadow-elevated transition-all p-12">
          <CardContent className="py-12 text-center flex flex-col items-center">
            <Search className="w-10 h-10 text-muted-foreground mb-3 opacity-40 animate-pulse" />
            <p className="text-foreground font-semibold">Tidak ada data ditemukan</p>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              Coba periksa ejaan nama atau perluas rentang tanggal
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
