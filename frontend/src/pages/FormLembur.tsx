import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, Calendar, FileText, CheckCircle2, UserCheck, ClipboardList } from "lucide-react";
import dayjs from "dayjs";

const FormLembur = () => {
  const { user } = useAuth();
  const [tglLembur, setTglLembur] = useState(dayjs().format("YYYY-MM-DD"));
  const [jamMulai, setJamMulai] = useState("16:00");
  const [jamSelesai, setJamSelesai] = useState("20:00");
  const [keterangan, setKeterangan] = useState("");
  const [loading, setLoading] = useState(false);
  const [myLembur, setMyLembur] = useState<any[]>([]);

  const fetchMyLembur = async () => {
    try {
      const token = localStorage.getItem("hr_token");
      const res = await fetch("http://localhost:3103/api/lembur/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setMyLembur(data.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMyLembur();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keterangan.trim()) {
      toast.error("Keterangan wajib diisi");
      return;
    }
    setLoading(true);

    try {
      const token = localStorage.getItem("hr_token");
      const res = await fetch("http://localhost:3103/api/lembur", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          tgl_lembur: tglLembur,
          jam_mulai: jamMulai,
          jam_selesai: jamSelesai,
          keterangan
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setKeterangan("");
        fetchMyLembur();
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error("Gagal mengirim form");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-900 pb-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Formulir Lembur</h1>
        <p className="text-slate-500">Pengajuan lembur karyawan</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 bg-white border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="text-lg text-slate-800">Identitas Karyawan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
             <div className="space-y-1 text-sm border-b border-slate-50 pb-2">
                <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Direktorat</p>
                <p className="font-medium text-slate-700">-</p>
             </div>
             <div className="space-y-1 text-sm border-b border-slate-50 pb-2">
                <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Bidang</p>
                <p className="font-semibold text-emerald-600">{user?.bidang || "-"}</p>
             </div>
             <div className="space-y-1 text-sm border-b border-slate-50 pb-2">
                <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Unit / Bagian</p>
                <p className="font-semibold text-blue-600">{user?.departemen || "-"}</p>
             </div>
             <div className="space-y-1 text-sm border-b border-slate-50 pb-2">
                <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Nama Karyawan</p>
                <p className="font-bold text-slate-900">{user?.nama}</p>
             </div>
             <div className="space-y-1 text-sm border-b border-slate-50 pb-2">
                <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Jabatan</p>
                <p className="font-medium text-slate-700">{user?.jbtn || "-"}</p>
             </div>
             <div className="space-y-1 text-sm">
                <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold">NIP / NIK</p>
                <p className="font-medium font-mono text-slate-600">{user?.nik}</p>
             </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 bg-white border-slate-200 shadow-md">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="text-lg text-slate-800">Detail Lembur</CardTitle>
            <CardDescription className="text-slate-500">Isi detail waktu dan keterangan tugas lembur</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="tgl" className="text-sm font-semibold text-slate-700">Tanggal Lembur</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input 
                      id="tgl" 
                      type="date" 
                      value={tglLembur} 
                      onChange={(e) => setTglLembur(e.target.value)}
                      className="bg-white border-slate-200 text-slate-900 pl-10 focus:ring-emerald-500" 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mulai" className="text-sm font-semibold text-slate-700">Jam Mulai</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input 
                      id="mulai" 
                      type="time" 
                      value={jamMulai} 
                      onChange={(e) => setJamMulai(e.target.value)}
                      className="bg-white border-slate-300 text-slate-900 pl-10 focus:ring-emerald-500" 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="selesai" className="text-sm font-semibold text-slate-700">Jam Selesai</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input 
                      id="selesai" 
                      type="time" 
                      value={jamSelesai} 
                      onChange={(e) => setJamSelesai(e.target.value)}
                      className="bg-white border-slate-300 text-slate-900 pl-10 focus:ring-emerald-500" 
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ket" className="text-sm font-semibold text-slate-700">Keterangan / Tugas</Label>
                <Textarea 
                  id="ket" 
                  placeholder="Deskripsikan pekerjaan yang dilakukan..." 
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  className="bg-white border-slate-300 text-slate-900 min-h-[100px] focus:ring-emerald-500"
                />
              </div>

              <div className="flex flex-col md:flex-row justify-between items-center gap-4 p-5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-100 text-emerald-600">
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Tugas disetujui oleh,</p>
                    <p className="text-xs text-slate-500 italic">Otomatis (Diri Sendiri)</p>
                  </div>
                </div>
                <Button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full md:w-auto px-10 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-md transition-all active:scale-95 border-0"
                >
                  {loading ? "Memproses..." : "AJUKAN LEMBUR"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
          <CardTitle className="text-lg text-slate-800">Riwayat Pengajuan</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/30">
                <TableRow className="hover:bg-transparent border-slate-100">
                  <TableHead className="text-slate-600 font-semibold py-4 px-6">Tanggal</TableHead>
                  <TableHead className="text-slate-600 font-semibold">Waktu</TableHead>
                  <TableHead className="text-slate-600 font-semibold">Total</TableHead>
                  <TableHead className="text-slate-600 font-semibold">Status</TableHead>
                  <TableHead className="text-slate-600 font-semibold text-center">Spv/Man</TableHead>
                  <TableHead className="text-slate-600 font-semibold text-center">HRD</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myLembur.length === 0 ? (
                  <TableRow>
                     <TableCell colSpan={6} className="text-center py-10 text-slate-400">
                       <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-20" />
                       Belum ada data pengajuan lembur
                     </TableCell>
                  </TableRow>
                ) : (
                  myLembur.map((item) => (
                    <TableRow key={item.id} className="hover:bg-slate-50 transition-colors border-slate-50">
                      <TableCell className="py-4 px-6 font-medium text-slate-800">{dayjs(item.tgl_lembur).format("DD MMM YYYY")}</TableCell>
                      <TableCell className="text-slate-600">{item.jam_mulai.substring(0,5)} - {item.jam_selesai.substring(0,5)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-slate-300 text-slate-700 font-mono bg-slate-50">
                          {item.total_jam}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`
                          ${item.status === 'PENDING' ? 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100' : ''}
                          ${item.status === 'APPROVED_SUPERVISOR' ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100' : ''}
                          ${item.status === 'APPROVED_HRD' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : ''}
                          ${item.status === 'REJECTED' ? 'bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-100' : ''}
                          font-medium border
                        `}>
                          {item.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {item.approved_supervisor_by ? <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto"/> : <span className="text-slate-300">—</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.approved_hrd_by ? <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto"/> : <span className="text-slate-300">—</span>}
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
};

export default FormLembur;
