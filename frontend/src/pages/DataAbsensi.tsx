import { useState, useMemo, useEffect, useCallback } from "react";
import { DEPARTEMEN_LIST } from "@/data/mockData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Filter, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [dept, setDept] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

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
      }
    } catch (error) {
      console.error("Error fetching absensi:", error);
      toast({ title: "Gagal", description: "Terjadi kesalahan saat mengambil data absensi.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, dept, status, search, toast]);

  useEffect(() => {
    fetchAbsensi();
  }, [fetchAbsensi]);

  const filtered = data; // Filtering is now handled on the server or via search state if needed localy for small sets

  const exportCSV = () => {
    const headers = "NIK,Nama,Departemen,Waktu,Status,Device\n";
    const rows = filtered.map(a =>
      `${a.pin},${a.nama_karyawan || "-"},${a.departemen || "-"},${a.waktu},${a.status},${a.device_id || "-"}`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `absensi_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "Berhasil", description: "Data berhasil diexport sebagai CSV." });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Riwayat Absensi</h1>
          <p className="text-muted-foreground text-sm">Data kehadiran pegawai hari ini & riwayat lengkap</p>
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
                  <TableHead>NIK</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead className="hidden md:table-cell">Departemen</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Jam Masuk</TableHead>
                  <TableHead>Jam Pulang</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Lokasi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      Memuat data absensi...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Tidak ada data ditemukan untuk filter ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-sm">{a.pin}</TableCell>
                      <TableCell className="font-medium">{a.nama_karyawan || "No Name"}</TableCell>
                      <TableCell className="hidden md:table-cell">{a.departemen || "-"}</TableCell>
                      <TableCell>{a.waktu.split(' ')[0]}</TableCell>
                      <TableCell>{a.waktu.split(' ')[1]}</TableCell>
                      <TableCell>{a.device_id || "-"}</TableCell>
                      <TableCell>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadge(a.status.charAt(0).toUpperCase() + a.status.slice(1))}`}>
                          {a.status}
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground">Internal</span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">Menampilkan {filtered.length} record</p>
    </div>
  );
}
