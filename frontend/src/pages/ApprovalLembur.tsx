import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, X, ShieldCheck, UserCog, Building } from "lucide-react";
import dayjs from "dayjs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ApprovalLembur = () => {
  const { user } = useAuth();
  const [supervisorList, setSupervisorList] = useState<any[]>([]);
  const [hrdList, setHrdList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLists = async () => {
    try {
      const token = localStorage.getItem("hr_token");
      const resSpv = await fetch("http://localhost:3103/api/lembur/pending-supervisor", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const dataSpv = await resSpv.json();
      if (dataSpv.success) setSupervisorList(dataSpv.data);

      const resHrd = await fetch("http://localhost:3103/api/lembur/pending-hrd", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const dataHrd = await resHrd.json();
      if (dataHrd.success) setHrdList(dataHrd.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchLists();
  }, []);

  const handleApprove = async (id: number, action: 'APPROVE' | 'REJECT') => {
    setLoading(true);
    try {
      const token = localStorage.getItem("hr_token");
      const res = await fetch(`http://localhost:3103/api/lembur/${id}/approve`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchLists();
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error("Gagal memproses data");
    } finally {
      setLoading(false);
    }
  };

  const isHRD = user?.role === 'Admin' || (user?.departemen && (user.departemen.includes('SDM') || user.departemen.includes('HRD') || user.departemen.includes('Personalia')));

  return (
    <div className="space-y-6 animate-fade-in text-slate-900 pb-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Approval Lembur</h1>
        <p className="text-slate-500">Kelola persetujuan lembur karyawan</p>
      </div>

      <Tabs defaultValue="supervisor" className="w-full">
        <TabsList className="bg-slate-100 p-1 mb-6 border border-slate-200 shadow-sm rounded-lg">
          <TabsTrigger value="supervisor" className="rounded-md px-8 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-emerald-700 transition-all font-medium">
            <UserCog className="w-4 h-4 mr-2" />
            Supervisor Approval
          </TabsTrigger>
          {isHRD && (
            <TabsTrigger value="hrd" className="rounded-md px-8 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-700 transition-all font-medium">
              <ShieldCheck className="w-4 h-4 mr-2" />
              HRD Approval
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="supervisor">
          <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
              <CardTitle className="flex items-center gap-2 text-xl text-slate-800">
                <Building className="w-5 h-5 text-emerald-600" />
                Antrian Approval Departemen
              </CardTitle>
              <CardDescription className="text-slate-500">Lembur yang menunggu validasi dari departemen / unit Anda</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/30">
                    <TableRow className="border-slate-100">
                      <TableHead className="text-slate-600 py-4 px-6 font-semibold">Karyawan</TableHead>
                      <TableHead className="text-slate-600 font-semibold">Tanggal</TableHead>
                      <TableHead className="text-slate-600 font-semibold">Waktu</TableHead>
                      <TableHead className="text-slate-600 font-semibold">Total</TableHead>
                      <TableHead className="text-slate-600 font-semibold">Keterangan</TableHead>
                      <TableHead className="text-slate-600 font-semibold text-right px-6">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supervisorList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-20 text-slate-400 border-0">
                          <div className="flex flex-col items-center gap-3">
                             <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center ring-1 ring-slate-100">
                               <UserCog className="w-8 h-8 opacity-40 text-slate-500" />
                             </div>
                             <p className="text-lg font-medium text-slate-500">Semua lembur sudah diproses ✨</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      supervisorList.map((item) => (
                        <TableRow key={item.id} className="hover:bg-slate-50 border-slate-100 transition-colors">
                          <TableCell className="py-5 px-6">
                            <p className="font-bold text-slate-900 leading-tight">{item.nama}</p>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">{item.jbtn}</p>
                          </TableCell>
                          <TableCell className="text-slate-700 font-medium">{dayjs(item.tgl_lembur).format("DD MMM YYYY")}</TableCell>
                          <TableCell className="font-mono text-sm text-slate-600">{item.jam_mulai.substring(0,5)} - {item.jam_selesai.substring(0,5)}</TableCell>
                          <TableCell>
                             <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 font-mono px-2 py-0.5 shadow-sm">
                               {item.total_jam}
                             </Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate italic text-slate-500 text-sm">
                            "{item.keterangan || '-'}"
                          </TableCell>
                          <TableCell className="text-right px-6">
                            <div className="flex justify-end gap-2">
                              <Button 
                                size="sm" 
                                onClick={() => handleApprove(item.id, 'APPROVE')} 
                                disabled={loading}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-all h-9"
                              >
                                <Check className="w-4 h-4 mr-1.5" /> Setuju
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleApprove(item.id, 'REJECT')} 
                                disabled={loading}
                                className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 font-medium h-9"
                              >
                                <X className="w-4 h-4 mr-1" /> Tolak
                              </Button>
                            </div>
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

        {isHRD && (
          <TabsContent value="hrd">
            <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
                <CardTitle className="flex items-center gap-2 text-xl text-slate-800">
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                  Antrian Final Approval (HRD)
                </CardTitle>
                <CardDescription className="text-slate-500">Lembur yang sudah disetujui departemen, siap dikirim ke jadwal dinas</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/30">
                      <TableRow className="border-slate-100">
                        <TableHead className="text-slate-600 py-4 px-6 font-semibold">Unit / Karyawan</TableHead>
                        <TableHead className="text-slate-600 font-semibold">Tanggal</TableHead>
                        <TableHead className="text-slate-600 font-semibold">Total Jam</TableHead>
                        <TableHead className="text-slate-600 font-semibold">Paraf Spv</TableHead>
                        <TableHead className="text-slate-600 font-semibold text-right px-6">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hrdList.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-20 text-slate-400 border-0">
                            <div className="flex flex-col items-center gap-3">
                               <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center ring-1 ring-slate-100">
                                 <ShieldCheck className="w-8 h-8 opacity-40 text-slate-500" />
                               </div>
                               <p className="text-lg font-medium text-slate-500">Semua lembur sudah diproses HRD 🚀</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        hrdList.map((item) => (
                          <TableRow key={item.id} className="hover:bg-slate-50 border-slate-100 transition-colors">
                            <TableCell className="py-5 px-6">
                              <p className="text-[10px] text-blue-700 font-extrabold uppercase tracking-widest bg-blue-50 w-fit px-2 py-0.5 rounded border border-blue-100 mb-1">{item.departemen}</p>
                              <p className="font-bold text-slate-900 leading-tight">{item.nama}</p>
                            </TableCell>
                            <TableCell className="text-slate-700 font-medium">{dayjs(item.tgl_lembur).format("DD MMM YYYY")}</TableCell>
                            <TableCell>
                              <span className="font-mono text-sm font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
                                {item.total_jam}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">DITERIMA TGL</span>
                                <span className="text-sm text-emerald-600 font-semibold">{dayjs(item.approved_supervisor_at).format("DD MMM, HH:mm")}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right px-6">
                              <div className="flex justify-end gap-2">
                                <Button 
                                  size="sm" 
                                  onClick={() => handleApprove(item.id, 'APPROVE')} 
                                  disabled={loading}
                                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-all h-9"
                                >
                                  <Check className="w-4 h-4 mr-1.5" /> Terima
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => handleApprove(item.id, 'REJECT')} 
                                  disabled={loading}
                                  className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 font-medium h-9"
                                >
                                  <X className="w-4 h-4 mr-1" /> Tolak
                                </Button>
                              </div>
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
        )}
      </Tabs>
    </div>
  );
};

export default ApprovalLembur;
