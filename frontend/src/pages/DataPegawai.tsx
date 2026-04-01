import { useEffect, useCallback, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Pegawai, DEPARTEMEN_LIST, BIDANG_LIST, JNJ_JABATAN_LIST } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Search, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const statusColor = (s: string) => {
  if (s === "Aktif") return "bg-success/10 text-success border-success/20";
  if (s === "Non-Aktif") return "bg-destructive/10 text-destructive border-destructive/20";
  return "bg-warning/10 text-warning border-warning/20";
};

export default function DataPegawai() {
  const { validatePassword } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<Pegawai[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [tab, setTab] = useState("data-pribadi");

  const fetchPegawai = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:3103/api/pegawai");
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error("Error fetching pegawai:", error);
      toast({ title: "Gagal", description: "Terjadi kesalahan saat mengambil data pegawai.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPegawai();
  }, [fetchPegawai]);

  // Form state
  const [form, setForm] = useState<Partial<Pegawai>>({
    nik: "", nama: "", jk: "L", jbtn: "", jnj_jabatan: "", departemen: "", bidang: "", stts_aktif: "Aktif", tgl_masuk: "", no_telp: "", alamat: "",
  });

  const filtered = data.filter(p =>
    p.nama.toLowerCase().includes(search.toLowerCase()) ||
    p.nik.toLowerCase().includes(search.toLowerCase()) ||
    p.departemen.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = () => {
    if (!form.nik || !form.nama) {
      toast({ title: "Error", description: "NIK dan Nama wajib diisi.", variant: "destructive" });
      return;
    }
    const newPegawai: Pegawai = {
      id: String(Date.now()),
      nik: form.nik!,
      nama: form.nama!,
      jk: (form.jk as "L" | "P") || "L",
      jbtn: form.jbtn || "",
      jnj_jabatan: form.jnj_jabatan || "",
      departemen: form.departemen || "",
      bidang: form.bidang || "",
      stts_aktif: (form.stts_aktif as Pegawai["stts_aktif"]) || "Aktif",
      tgl_masuk: form.tgl_masuk || new Date().toISOString().split("T")[0],
      no_telp: form.no_telp || "",
      alamat: form.alamat || "",
    };
    setData([...data, newPegawai]);
    setShowAdd(false);
    setForm({ nik: "", nama: "", jk: "L", jbtn: "", jnj_jabatan: "", departemen: "", bidang: "", stts_aktif: "Aktif", tgl_masuk: "", no_telp: "", alamat: "" });
    toast({ title: "Berhasil", description: "Pegawai baru berhasil ditambahkan." });
  };

  const handleDelete = () => {
    if (!validatePassword(deletePassword)) {
      toast({ title: "Gagal", description: "Password admin salah.", variant: "destructive" });
      return;
    }
    setData(data.filter(p => p.id !== deleteTarget));
    setDeleteTarget(null);
    setDeletePassword("");
    toast({ title: "Dihapus", description: "Data pegawai berhasil dihapus." });
  };

  const updateForm = (key: string, value: string) => setForm({ ...form, [key]: value });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Data Pegawai</h1>
          <p className="text-muted-foreground text-sm">Kelola data kepegawaian RS Permata Keluarga</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-2">
          <UserPlus className="w-4 h-4" /> Tambah Pegawai
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Cari NIK, nama, atau departemen..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Badge variant="outline">{filtered.length} pegawai</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NIK</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead className="hidden md:table-cell">JK</TableHead>
                  <TableHead className="hidden lg:table-cell">Jabatan</TableHead>
                  <TableHead>Departemen</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-sm">{p.nik}</TableCell>
                    <TableCell className="font-medium">{p.nama}</TableCell>
                    <TableCell className="hidden md:table-cell">{p.jk === "L" ? "Laki-laki" : "Perempuan"}</TableCell>
                    <TableCell className="hidden lg:table-cell">{p.jbtn}</TableCell>
                    <TableCell>{p.departemen}</TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor(p.stts_aktif)}`}>
                        {p.stts_aktif}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(p.id)} title="Hapus">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Memuat data pegawai...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Tidak ada data ditemukan.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add Employee Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" /> Tambah Pegawai Baru
            </DialogTitle>
          </DialogHeader>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="data-pribadi">Data Pribadi</TabsTrigger>
              <TabsTrigger value="jabatan">Jabatan</TabsTrigger>
              <TabsTrigger value="kontak">Kontak</TabsTrigger>
            </TabsList>
            <TabsContent value="data-pribadi" className="space-y-3 mt-4">
              <div className="space-y-2">
                <Label>NIK *</Label>
                <Input value={form.nik} onChange={e => updateForm("nik", e.target.value)} placeholder="Contoh: PEG009" />
              </div>
              <div className="space-y-2">
                <Label>Nama Lengkap *</Label>
                <Input value={form.nama} onChange={e => updateForm("nama", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Jenis Kelamin</Label>
                <Select value={form.jk} onValueChange={v => updateForm("jk", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">Laki-laki</SelectItem>
                    <SelectItem value="P">Perempuan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tanggal Masuk</Label>
                <Input type="date" value={form.tgl_masuk} onChange={e => updateForm("tgl_masuk", e.target.value)} />
              </div>
            </TabsContent>
            <TabsContent value="jabatan" className="space-y-3 mt-4">
              <div className="space-y-2">
                <Label>Jabatan</Label>
                <Input value={form.jbtn} onChange={e => updateForm("jbtn", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Jenjang Jabatan</Label>
                <Select value={form.jnj_jabatan} onValueChange={v => updateForm("jnj_jabatan", v)}>
                  <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
                  <SelectContent>
                    {JNJ_JABATAN_LIST.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Departemen</Label>
                <Select value={form.departemen} onValueChange={v => updateForm("departemen", v)}>
                  <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
                  <SelectContent>
                    {DEPARTEMEN_LIST.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Bidang</Label>
                <Select value={form.bidang} onValueChange={v => updateForm("bidang", v)}>
                  <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
                  <SelectContent>
                    {BIDANG_LIST.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.stts_aktif} onValueChange={v => updateForm("stts_aktif", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Aktif">Aktif</SelectItem>
                    <SelectItem value="Non-Aktif">Non-Aktif</SelectItem>
                    <SelectItem value="Cuti">Cuti</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
            <TabsContent value="kontak" className="space-y-3 mt-4">
              <div className="space-y-2">
                <Label>No. Telepon</Label>
                <Input value={form.no_telp} onChange={e => updateForm("no_telp", e.target.value)} placeholder="08xxxxxxxxxx" />
              </div>
              <div className="space-y-2">
                <Label>Alamat</Label>
                <Input value={form.alamat} onChange={e => updateForm("alamat", e.target.value)} />
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowAdd(false)}>Batal</Button>
            <Button onClick={handleAdd}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => { setDeleteTarget(null); setDeletePassword(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive">Konfirmasi Hapus Pegawai</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Masukkan password admin Anda untuk mengkonfirmasi penghapusan data pegawai ini.</p>
          <Input type="password" placeholder="Password Admin" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeletePassword(""); }}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete}>Hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
