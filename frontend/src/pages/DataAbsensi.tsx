import { useState, useMemo, useEffect, useCallback } from "react";
import { DEPARTEMEN_LIST } from "@/data/mockData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Filter, MapPin, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import dayjs from "dayjs";
import "dayjs/locale/id";

// Set locale dayjs ke Indonesia
dayjs.locale("id");

const statusBadge = (s: string) => {
  if (s === "Masuk") return "bg-primary/10 text-primary border-primary/20";
  if (s === "Pulang") return "bg-success/10 text-success border-success/20";
  if (s === "Izin") return "bg-warning/10 text-warning border-warning/20";
  return "bg-destructive/10 text-destructive border-destructive/20";
};

export default function DataAbsensi() {
  const { toast } = useToast();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(new Date().toLocaleDateString('en-CA')); // YYYY-MM-DD local
  const [dateTo, setDateTo] = useState(new Date().toLocaleDateString('en-CA')); // YYYY-MM-DD local
  const [dept, setDept] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  
  // State untuk Sorting
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({
    key: "waktu",
    direction: "desc"
  });

  const fetchAbsensi = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        startDate: dateFrom,
        endDate: dateTo,
        departemen: dept,
        status: status,
        pin: search
      });
      const response = await fetch(`http://localhost:3103/api/absensi?${params}`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        toast({ title: "Gagal", description: result.message || "Gagal mengambil data.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error fetching absensi:", error);
      toast({ title: "Gagal", description: "Terjadi kesalahan koneksi ke server.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, dept, status, search, toast]);

  useEffect(() => {
    fetchAbsensi();
  }, [fetchAbsensi]);

  // Handle Sorting & Data Processing
  const processedData = useMemo(() => {
    let items = [...data];
    
    // 1. Sort Data
    if (sortConfig) {
      items.sort((a, b) => {
        const valA = a[sortConfig.key] || "";
        const valB = b[sortConfig.key] || "";
        
        if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
        if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    // 2. Assign Group Index for Zigzag Coloring (Based on Date)
    let lastDate = "";
    let groupIndex = -1;
    
    return items.map((item) => {
      const currentDate = item.waktu.split(" ")[0];
      if (currentDate !== lastDate) {
        groupIndex++;
        lastDate = currentDate;
      }
      return { ...item, groupIndex };
    });
  }, [data, sortConfig]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" />;
    return sortConfig.direction === 'asc' 
      ? <ChevronUp className="w-4 h-4 ml-1 text-primary" /> 
      : <ChevronDown className="w-4 h-4 ml-1 text-primary" />;
  };

  const exportCSV = () => {
    const headers = "NIK,Nama,Departemen,Waktu,Status,Device\n";
    const rows = processedData.map(a =>
      `${a.pin},${a.nama_karyawan || "-"},${a.departemen || "-"},${a.waktu},${a.status},${a.device_id || "-"}`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `absensi_${new Date().toLocaleDateString('en-CA')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "Berhasil", description: "Data berhasil diexport sebagai CSV." });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Riwayat Log Absensi</h1>
          <p className="text-muted-foreground text-sm">Data scan mesin absensi secara real-time</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAbsensi} className="gap-2">
            Refresh
          </Button>
          <Button variant="default" onClick={exportCSV} className="gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Cari Nama / NIP</label>
              <Input 
                placeholder="Ketik NIP atau Nama..." 
                value={search} 
                onChange={e => setSearch(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Dari Tanggal</label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Sampai Tanggal</label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9" />
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
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="masuk">Masuk (In)</SelectItem>
                  <SelectItem value="pulang">Pulang (Out)</SelectItem>
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
                  <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => requestSort('pin')}>
                    <div className="flex items-center">NIK {getSortIcon('pin')}</div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => requestSort('nama_karyawan')}>
                    <div className="flex items-center">Nama {getSortIcon('nama_karyawan')}</div>
                  </TableHead>
                  <TableHead className="hidden md:table-cell cursor-pointer hover:bg-muted/50" onClick={() => requestSort('departemen')}>
                    <div className="flex items-center">Departemen {getSortIcon('departemen')}</div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => requestSort('waktu')}>
                    <div className="flex items-center">Hari/Tanggal {getSortIcon('waktu')}</div>
                  </TableHead>
                  <TableHead>Jam Scan</TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => requestSort('status')}>
                    <div className="flex items-center">Status {getSortIcon('status')}</div>
                  </TableHead>
                  <TableHead className="text-center">Lebih</TableHead>
                  <TableHead>Mesin/ID</TableHead>
                  <TableHead className="hidden lg:table-cell">Lokasi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      Memuat data absensi...
                    </TableCell>
                  </TableRow>
                ) : processedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Tidak ada data ditemukan untuk filter ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  processedData.map(a => {
                    const rowDate = dayjs(a.waktu);
                    const formatSelisih = (totalSec: number) => {
                      if (!totalSec || totalSec <= 0) return "-";
                      const h = Math.floor(totalSec / 3600);
                      const m = Math.floor((totalSec % 3600) / 60);
                      const s = totalSec % 60;
                      
                      const parts = [];
                      if (h > 0) parts.push(`${h}j`);
                      if (m > 0) parts.push(`${m}m`);
                      if (s > 0) parts.push(`${s}d`);
                      
                      return parts.length > 0 ? parts.join(" ") : "-";
                    };

                    return (
                      <TableRow 
                        key={a.id} 
                        className={`transition-colors border-l-4 ${a.groupIndex % 2 === 0 ? 'bg-white border-l-blue-400' : 'bg-slate-50 border-l-emerald-400'}`}
                      >
                        <TableCell className="font-mono text-sm">{a.pin}</TableCell>
                        <TableCell className="font-medium">{a.nama_karyawan || "No Name"}</TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{a.departemen || "-"}</TableCell>
                        <TableCell className="capitalize whitespace-nowrap">
                          {rowDate.format('dddd, DD-MM-YYYY')}
                        </TableCell>
                        <TableCell className="font-bold">{rowDate.format('HH:mm:ss')}</TableCell>
                        <TableCell>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${statusBadge(a.status.charAt(0).toUpperCase() + a.status.slice(1))}`}>
                            {a.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {a.selisih > 0 ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 font-bold text-[10px]">
                              +{formatSelisih(a.selisih)}
                            </Badge>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{a.device_id || "-"}</TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Internal</span>
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
      <div className="flex justify-between items-center px-2">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider italic">
          * Warna baris berganti setiap perubahan tanggal untuk memudahkan pengamatan
        </p>
        <p className="text-xs font-bold bg-slate-100 px-2 py-1 rounded border">Menampilkan {processedData.length} record</p>
      </div>
    </div>
  );
}
