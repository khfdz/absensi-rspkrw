import { useState, useEffect, useCallback } from "react";
import { API_BASE } from "@/config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Database, 
  Network, 
  Clock, 
  Download, 
  Info, 
  Layers,
  ArrowRight,
  ShieldCheck,
  ServerCrash
} from "lucide-react";
import dayjs from "dayjs";

interface MachineSummary {
  name: string;
  ip: string;
  status: 'pending' | 'success' | 'error';
  downloaded: number;
  inserted: number;
  skipped: number;
  errors: number;
  errorMsg: string | null;
  note?: string;
}

interface LastSync {
  time: string;
  inserted: number;
  skipped: number;
  errors: number;
}

interface SyncData {
  isSyncing: boolean;
  status: 'idle' | 'connecting' | 'downloading' | 'saving' | 'done' | 'error';
  currentMachine: string | null;
  currentMachineIndex: number;
  totalMachines: number;
  progress: number;
  processedCount: number;
  totalCount: number;
  inserted: number;
  skipped: number;
  errors: number;
  timeRemaining: string | null;
  errorMsg: string | null;
  lastSync: LastSync | null;
  machineSummaries: MachineSummary[];
}

export default function SyncDatabase() {
  const { toast } = useToast();
  const [syncState, setSyncState] = useState<SyncData>({
    isSyncing: false,
    status: "idle",
    currentMachine: null,
    currentMachineIndex: 0,
    totalMachines: 0,
    progress: 0,
    processedCount: 0,
    totalCount: 0,
    inserted: 0,
    skipped: 0,
    errors: 0,
    timeRemaining: null,
    errorMsg: null,
    lastSync: null,
    machineSummaries: []
  });
  const [loading, setLoading] = useState(true);

  // Fetch status sinkronisasi dari backend
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/mesin/sync/status`);
      if (!response.ok) throw new Error("Gagal mengambil status");
      const result = await response.json();
      if (result.success) {
        setSyncState(result.data);
      }
    } catch (error) {
      console.error("Gagal polling status sync:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Polling jika proses sinkronisasi sedang berjalan
  useEffect(() => {
    fetchStatus();

    let intervalId: NodeJS.Timeout | null = null;
    if (syncState.isSyncing) {
      intervalId = setInterval(() => {
        fetchStatus();
      }, 1000); // Poll setiap 1 detik
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [syncState.isSyncing, fetchStatus]);

  // Memicu sinkronisasi
  const handleStartSync = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/mesin/sync`, {
        method: "POST",
      });
      const result = await response.json();
      if (result.success) {
        setSyncState(result.data);
        toast({
          title: "Sinkronisasi Dimulai",
          description: "Menghubungkan ke mesin absensi...",
        });
      } else {
        toast({
          title: "Gagal Sinkronisasi",
          description: result.message || "Gagal memulai sinkronisasi.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error trigger sync:", error);
      toast({
        title: "Kesalahan Koneksi",
        description: "Gagal terhubung ke server backend.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Helper untuk mendapatkan badge status sync
  const getStatusBadge = (status: SyncData["status"]) => {
    switch (status) {
      case "idle":
        return <Badge variant="outline" className="bg-muted text-muted-foreground border border-border font-bold text-[10px] tracking-wider rounded-full px-2.5 py-0.5 shadow-sm">Menunggu</Badge>;
      case "connecting":
        return <Badge variant="outline" className="bg-primary/10 text-primary border border-primary/20 font-bold text-[10px] tracking-wider rounded-full px-2.5 py-0.5 shadow-sm animate-pulse">Menghubungkan...</Badge>;
      case "downloading":
        return <Badge variant="outline" className="bg-warning/10 text-warning border border-warning/20 font-bold text-[10px] tracking-wider rounded-full px-2.5 py-0.5 shadow-sm animate-pulse">Mengunduh Log...</Badge>;
      case "saving":
        return <Badge variant="outline" className="bg-success/10 text-success border border-success/20 font-bold text-[10px] tracking-wider rounded-full px-2.5 py-0.5 shadow-sm animate-pulse">Menyimpan ke DB...</Badge>;
      case "done":
        return <Badge variant="outline" className="bg-success/10 text-success border border-success/20 font-bold text-[10px] tracking-wider rounded-full px-2.5 py-0.5 shadow-sm">Selesai</Badge>;
      case "error":
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border border-destructive/20 font-bold text-[10px] tracking-wider rounded-full px-2.5 py-0.5 shadow-sm">Error</Badge>;
      default:
        return <Badge variant="outline" className="font-bold text-[10px] tracking-wider rounded-full px-2.5 py-0.5">{status}</Badge>;
    }
  };

  // Helper deskripsi status
  const getStatusDescription = () => {
    if (syncState.status === "connecting") {
      return `Membuka soket TCP ke ${syncState.currentMachine || "mesin absensi"}...`;
    }
    if (syncState.status === "downloading") {
      return `Mendownload log memori dari ${syncState.currentMachine || "mesin absensi"} (Bisa memakan waktu 1-3 menit)...`;
    }
    if (syncState.status === "saving") {
      return `Memeriksa duplikasi dan menyimpan log ke DB: ${syncState.processedCount} dari ${syncState.totalCount} record.`;
    }
    if (syncState.status === "done") {
      return "Semua mesin absensi berhasil disinkronkan ke database MySQL.";
    }
    if (syncState.status === "error") {
      return `Gagal memproses sinkronisasi: ${syncState.errorMsg || "Unknown error"}`;
    }
    return "Sistem siap melakukan sinkronisasi database manual.";
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Database className="w-6 h-6 text-primary animate-scale-in" />
            Sinkronisasi Database
          </h1>
          <p className="text-muted-foreground text-sm font-medium">
            Tarik data log absensi langsung dari memori mesin ZKTeco via TCP
          </p>
        </div>
        <div>
          <Button 
            onClick={handleStartSync} 
            disabled={syncState.isSyncing || loading}
            className="gap-2 bg-primary text-primary-foreground hover:opacity-90 transition-all rounded-2xl font-bold shadow-card h-11 px-6 min-w-[170px]"
          >
            <RefreshCw className={`w-4 h-4 ${syncState.isSyncing ? "animate-spin" : ""}`} />
            {syncState.isSyncing ? "Proses Sync..." : "Mulai Sinkronisasi"}
          </Button>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Sync Progress & Controls */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card Progress Utama */}
          <Card className={`relative overflow-hidden bg-card rounded-2xl border border-border shadow-card hover:shadow-elevated transition-all duration-200 animate-slide-up`}>
            {syncState.isSyncing && (
              <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-primary via-info to-success animate-pulse" />
            )}
            
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Database className="w-4 h-4 text-primary" />
                  Status Sinkronisasi
                </CardTitle>
                {getStatusBadge(syncState.status)}
              </div>
              <CardDescription className="text-xs font-semibold text-muted-foreground mt-2">
                {getStatusDescription()}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Progress Section */}
              {syncState.isSyncing && (
                <div className="space-y-3.5 p-4 bg-muted rounded-2xl border border-border">
                  <div className="flex justify-between items-center text-xs font-bold text-muted-foreground">
                    <span className="flex items-center gap-1 uppercase tracking-wider">
                      <Network className="w-3.5 h-3.5 text-primary" />
                      Mesin ({syncState.currentMachineIndex}/{syncState.totalMachines}): {syncState.currentMachine}
                    </span>
                    <span className="text-sm text-primary font-bold font-mono">{syncState.progress}%</span>
                  </div>
                  
                  <Progress value={syncState.progress} className="h-2.5 bg-border rounded-full" />
                  
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pt-1 text-xs">
                    <div className="text-muted-foreground font-bold">
                      Tahap: <span className="text-foreground uppercase">{syncState.status}</span>
                    </div>
                    
                    {/* Time remaining estimate */}
                    {syncState.timeRemaining && (
                      <div className="flex items-center gap-1.5 font-bold text-warning bg-warning/10 border border-warning/20 px-2.5 py-0.5 rounded-full animate-pulse">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Estimasi sisa waktu: ~{syncState.timeRemaining}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Status Idle / Tidak Syncing */}
              {!syncState.isSyncing && (
                <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
                  <div className="w-12 h-12 bg-muted border border-border rounded-2xl flex items-center justify-center text-muted-foreground/60 shadow-sm">
                    <Info className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-foreground text-sm">Mesin Sedang Standby</p>
                    <p className="text-xs text-muted-foreground max-w-sm font-medium">
                      Tekan tombol **Mulai Sinkronisasi** di kanan atas untuk mengunduh log terbaru dari mesin absensi fisik rumah sakit.
                    </p>
                  </div>
                </div>
              )}

              {/* Last Sync Info */}
              {syncState.lastSync && (
                <div className="border-t border-border pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1 text-muted-foreground font-medium">
                    <p className="uppercase tracking-wider font-bold text-[10px]">Sinkronisasi Terakhir</p>
                    <p className="font-bold text-foreground text-sm">
                      {dayjs(syncState.lastSync.time).format("DD MMMM YYYY, HH:mm:ss")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center sm:justify-end">
                    <Badge variant="outline" className="bg-success/10 text-success border-success/20 font-bold px-2 py-0.5 rounded-full">
                      +{syncState.lastSync.inserted} Baru
                    </Badge>
                    <Badge variant="outline" className="bg-muted text-muted-foreground border-border font-bold px-2 py-0.5 rounded-full">
                      {syncState.lastSync.skipped} Duplikat
                    </Badge>
                    {syncState.lastSync.errors > 0 && (
                      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 font-bold px-2 py-0.5 rounded-full">
                        {syncState.lastSync.errors} Gagal
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Breakdown Table Per Mesin */}
          <Card className="bg-card rounded-2xl border border-border shadow-card hover:shadow-elevated transition-all duration-200 overflow-hidden animate-slide-up">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                Hasil Sinkronisasi Per Mesin
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">Detail status koneksi dan penarikan log per IP address</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30 border-b border-border">
                    <TableRow>
                      <TableHead className="font-bold text-xs text-muted-foreground">Nama Mesin</TableHead>
                      <TableHead className="font-bold text-xs text-muted-foreground">IP Address</TableHead>
                      <TableHead className="font-bold text-xs text-muted-foreground">Status Koneksi</TableHead>
                      <TableHead className="text-right font-bold text-xs text-muted-foreground">Total Log</TableHead>
                      <TableHead className="text-right font-bold text-xs text-success bg-success/5">Baru</TableHead>
                      <TableHead className="text-right font-bold text-xs text-muted-foreground">Skip</TableHead>
                      <TableHead className="text-right font-bold text-xs text-destructive bg-destructive/5">Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncState.machineSummaries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-6 text-muted-foreground text-xs font-semibold">
                          Belum ada data riwayat mesin. Mulai sinkronisasi untuk melihat detail.
                        </TableCell>
                      </TableRow>
                    ) : (
                      syncState.machineSummaries.map((m, i) => (
                        <TableRow key={i} className="hover:bg-muted/10 border-b border-border/40 transition-colors">
                          <TableCell className="font-bold text-xs text-foreground">{m.name}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{m.ip}</TableCell>
                          <TableCell>
                            {m.status === 'success' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[9px] font-bold text-success bg-success/10 border border-success/20 rounded-full uppercase">
                                <CheckCircle2 className="w-3 h-3 text-success" />
                                Sukses
                              </span>
                            ) : m.status === 'error' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[9px] font-bold text-destructive bg-destructive/10 border border-destructive/20 rounded-full uppercase" title={m.errorMsg || ""}>
                                <ServerCrash className="w-3 h-3 text-destructive" />
                                Gagal
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[9px] font-bold text-muted-foreground bg-muted border border-border rounded-full uppercase">
                                Antri
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-bold font-mono text-xs text-foreground">{m.downloaded}</TableCell>
                          <TableCell className="text-right font-bold font-mono text-xs text-success bg-success/5">+{m.inserted}</TableCell>
                          <TableCell className="text-right font-semibold font-mono text-xs text-muted-foreground">{m.skipped}</TableCell>
                          <TableCell className="text-right font-bold font-mono text-xs text-destructive bg-destructive/5">{m.errors}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Quick Stats & DB State */}
        <div className="space-y-6">
          {/* Card Summary Counter */}
          <Card className="gradient-primary rounded-2xl text-primary-foreground border-0 shadow-card hover:shadow-elevated transition-all duration-200 animate-slide-up">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider font-bold opacity-90">
                Total Data Diperoleh
              </CardTitle>
              <div className="flex items-baseline justify-between pt-2">
                <span className="text-3xl font-extrabold font-mono text-primary-foreground">
                  {syncState.inserted + syncState.skipped}
                </span>
                <span className="text-xs bg-primary-foreground/20 text-primary-foreground px-2.5 py-0.5 rounded-full font-bold">
                  Sesi Ini
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-[11px] text-primary-foreground/80 leading-relaxed font-semibold">
                Menyaring duplikasi secara otomatis sebelum disimpan ke database utama dan tabel record.
              </p>
            </CardContent>
          </Card>

          {/* Breakdown Cards */}
          <div className="grid grid-cols-2 gap-4 animate-slide-up">
            {/* Inserted */}
            <Card className="bg-card border border-border border-l-4 border-l-success rounded-2xl shadow-card hover:shadow-elevated transition-all duration-200">
              <CardHeader className="p-3 pb-1">
                <CardDescription className="text-[10px] font-bold uppercase text-muted-foreground/85">
                  Data Baru
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 pt-0 flex items-center justify-between">
                <span className="text-xl font-extrabold font-mono text-success">
                  {syncState.inserted}
                </span>
                <div className="p-1.5 bg-success/10 text-success rounded-lg border border-success/20">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>

            {/* Skipped */}
            <Card className="bg-card border border-border border-l-4 border-l-muted-foreground/60 rounded-2xl shadow-card hover:shadow-elevated transition-all duration-200">
              <CardHeader className="p-3 pb-1">
                <CardDescription className="text-[10px] font-bold uppercase text-muted-foreground/85">
                  Duplikat
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 pt-0 flex items-center justify-between">
                <span className="text-xl font-extrabold font-mono text-muted-foreground">
                  {syncState.skipped}
                </span>
                <div className="p-1.5 bg-muted text-muted-foreground rounded-lg border border-border">
                  <Layers className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>

            {/* Errors */}
            <Card className="bg-card border border-border border-l-4 border-l-destructive rounded-2xl shadow-card hover:shadow-elevated transition-all duration-200">
              <CardHeader className="p-3 pb-1">
                <CardDescription className="text-[10px] font-bold uppercase text-muted-foreground/85">
                  Gagal
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 pt-0 flex items-center justify-between">
                <span className="text-xl font-extrabold font-mono text-destructive">
                  {syncState.errors}
                </span>
                <div className="p-1.5 bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
                  <AlertCircle className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>

            {/* Log Counts */}
            <Card className="bg-card border border-border border-l-4 border-l-primary rounded-2xl shadow-card hover:shadow-elevated transition-all duration-200">
              <CardHeader className="p-3 pb-1">
                <CardDescription className="text-[10px] font-bold uppercase text-muted-foreground/85">
                  Total Log
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 pt-0 flex items-center justify-between">
                <span className="text-xl font-extrabold font-mono text-primary">
                  {syncState.totalCount}
                </span>
                <div className="p-1.5 bg-primary/10 text-primary rounded-lg border border-primary/20">
                  <Download className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Device & Server Connection Info */}
          <Card className="bg-card rounded-2xl border border-border shadow-card hover:shadow-elevated transition-all duration-200 overflow-hidden animate-slide-up">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                <Info className="w-4 h-4 text-primary" />
                Informasi Jaringan Mesin
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-muted-foreground pt-4">
              <div className="p-4 bg-muted border border-border rounded-2xl flex items-start gap-2.5">
                <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="leading-relaxed text-foreground font-semibold">
                  Pastikan PC server ini berada dalam jaringan lokal (subnet yang sama) dengan mesin absensi di **192.168.10.150** dan **192.168.10.185** agar port TCP **4370** tidak diblokir oleh firewall router rumah sakit.
                </p>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-foreground">Daftar Port & Protokol:</p>
                <ul className="list-disc pl-4 space-y-1 font-semibold">
                  <li>Protokol: TCP/IP</li>
                  <li>Port default Solution/ZKTeco: <span className="font-mono bg-muted border border-border px-1.5 py-0.5 rounded-lg text-foreground">4370</span></li>
                  <li>Driver: node-zklib Socket Wrapper</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
