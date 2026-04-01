import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download, Search, RefreshCw, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DEPARTEMEN_LIST } from "@/data/mockData";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function RekapAbsensi() {
  const { toast } = useToast();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("all");

  const fetchRekap = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`http://localhost:3103/api/absensi/rekap?tanggal=${tanggal}`);
      const result = await res.json();
      if (result.success) {
        // Filter out employees with no data at all for this day if preferred, 
        // but user wants to see "Lupa Absen" so we keep them from backend.
        setData(result.data);
      }
    } catch (error) {
      console.error("Error fetching rekap:", error);
      toast({ title: "Gagal", description: "Terjadi kesalahan saat mengambil rekap absensi.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [tanggal, toast]);

  useEffect(() => {
    fetchRekap();
  }, [fetchRekap]);

  const filtered = data.filter(item => {
    const matchesSearch = item.nama.toLowerCase().includes(search.toLowerCase()) || 
                         item.pin.toLowerCase().includes(search.toLowerCase());
    const matchesDept = dept === "all" || item.departemen === dept;
    return matchesSearch && matchesDept;
  });

  const exportCSV = () => {
    const headers = "NIK,Nama,Departemen,Tanggal,Jam Masuk,Jam Pulang,Status,Lokasi\n";
    const rows = filtered.map(a =>
      `${a.pin},${a.nama},${a.departemen},${a.tanggal},${a.jam_masuk || "-"},${a.jam_pulang || "-"},${a.status},${a.lokasi}`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rekap_absensi_${tanggal}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "Berhasil", description: "Data rekap berhasil diexport." });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Rekap Absensi Harian</h1>
          <p className="text-muted-foreground text-sm">Log Masuk & Pulang disatukan dalam satu baris (Mendukung Shift Malam)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchRekap} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Sinkronkan Data
          </Button>
          <Button onClick={exportCSV} className="gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Tanggal Kerja</label>
              <Input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Cari Nama / NIP</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Ketik NIP atau Nama..." 
                  value={search} 
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Departemen</label>
              <Select value={dept} onValueChange={setDept}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Departemen</SelectItem>
                  {DEPARTEMEN_LIST.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">NIK</TableHead>
                  <TableHead>Nama Pegawai</TableHead>
                  <TableHead className="hidden md:table-cell">Departemen</TableHead>
                  <TableHead className="text-center bg-blue-50/50">Jam Masuk</TableHead>
                  <TableHead className="text-center bg-orange-50/50">Jam Pulang</TableHead>
                  <TableHead className="text-center">Lokasi</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-20">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-sm font-medium text-muted-foreground">Menganalisis data masuk & pulang...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      Tidak ada data absensi ditemukan untuk tanggal ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((a, idx) => (
                    <TableRow key={`${a.pin}-${idx}`} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-mono text-sm font-medium">{a.pin}</TableCell>
                      <TableCell>
                        <div className="font-medium">{a.nama || "—"}</div>
                        <div className="text-[10px] text-muted-foreground md:hidden">{a.departemen}</div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{a.departemen || "—"}</TableCell>
                      
                      <TableCell className="text-center">
                        {a.jam_masuk ? (
                          <span className="font-bold text-blue-600">{a.jam_masuk}</span>
                        ) : (
                          <Badge variant="outline" className="text-red-500 border-red-200 bg-red-50/30 text-[10px] gap-1 px-1.5 h-5 font-bold uppercase">
                            <XCircle className="w-3 h-3" /> Lupa Masuk
                          </Badge>
                        )}
                      </TableCell>
                      
                      <TableCell className="text-center">
                        {a.jam_pulang ? (
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-orange-600">{a.jam_pulang}</span>
                            {a.tgl_pulang !== a.tanggal && (
                              <span className="text-[9px] text-muted-foreground font-medium italic">(Esok hari)</span>
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-red-500 border-red-200 bg-red-50/30 text-[10px] gap-1 px-1.5 h-5 font-bold uppercase">
                            <XCircle className="w-3 h-3" /> Lupa Pulang
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="text-center text-xs font-medium text-muted-foreground">
                        {a.lokasi || "—"}
                      </TableCell>

                      <TableCell className="text-center">
                        {a.status === 'LENGKAP' ? (
                          <div className="flex justify-center">
                            <div className="bg-green-100 text-green-700 p-1 rounded-full border border-green-200 shadow-sm">
                              <CheckCircle2 className="w-5 h-5" />
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-center">
                            <div className="bg-red-50 text-red-500 p-1 rounded-full border border-red-100">
                              <AlertCircle className="w-5 h-5" />
                            </div>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium">Total Pegawai Terdeteksi: {filtered.length}</p>
        <div className="flex gap-4 text-xs font-semibold uppercase tracking-wider">
          <div className="flex items-center gap-1.5 text-green-600">
            <div className="w-2 h-2 rounded-full bg-green-600"></div> Lengkap
          </div>
          <div className="flex items-center gap-1.5 text-red-500">
            <div className="w-2 h-2 rounded-full bg-red-500"></div> Tidak Lengkap
          </div>
        </div>
      </div>
    </div>
  );
}

