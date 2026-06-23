import { useState, useEffect, useMemo } from "react";
import { API_BASE } from "@/config";
import { 
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Dialog, DialogContent, DialogHeader, 
  DialogTitle, DialogDescription 
} from "@/components/ui/dialog";
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
  Search, Shield, Eye, EyeOff, Key, User, 
  Building, Settings2, Download, ArrowUpDown, 
  ArrowUp, ArrowDown, Filter
} from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import * as XLSX from 'xlsx';

interface SikkUser {
  nik_decrypted: string;
  password_decrypted: string;
  nama?: string;
  departemen?: string;
  id_user: string;
  password: string;
  [key: string]: any;
}

type SortOrder = 'asc' | 'desc' | 'none';

const SikkUsers = () => {
  const [users, setUsers] = useState<SikkUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>('none');
  const [showPasswords, setShowPasswords] = useState<Record<number, boolean>>({});
  const [selectedUser, setSelectedUser] = useState<SikkUser | null>(null);
  const [detailSearch, setDetailSearch] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/pegawai/sikk-users`);
      const result = await res.json();
      if (result.success) {
        setUsers(result.data);
      } else {
        toast.error("Gagal mengambil data user SIKKRW");
      }
    } catch (err) {
      console.error(err);
      toast.error("Terjadi kesalahan koneksi ke server");
    } finally {
      setLoading(false);
    }
  };

  const departments = useMemo(() => {
    const depts = new Set<string>();
    users.forEach(u => { if (u.departemen) depts.add(u.departemen); });
    return Array.from(depts).sort();
  }, [users]);

  const togglePassword = (idx: number) => {
    setShowPasswords(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const processedUsers = useMemo(() => {
    let filtered = users.filter(u => 
      u.nik_decrypted?.toLowerCase().includes(search.toLowerCase()) ||
      u.nama?.toLowerCase().includes(search.toLowerCase()) ||
      u.departemen?.toLowerCase().includes(search.toLowerCase())
    );

    if (deptFilter !== "all") {
      filtered = filtered.filter(u => u.departemen === deptFilter);
    }

    if (sortOrder !== 'none') {
      filtered.sort((a, b) => {
        const deptA = a.departemen || "";
        const deptB = b.departemen || "";
        return sortOrder === 'asc' 
          ? deptA.localeCompare(deptB) 
          : deptB.localeCompare(deptA);
      });
    }

    return filtered;
  }, [users, search, deptFilter, sortOrder]);

  const toggleSort = () => {
    setSortOrder(prev => {
      if (prev === 'none') return 'asc';
      if (prev === 'asc') return 'desc';
      return 'none';
    });
  };

  const getPermissions = (user: SikkUser | null) => {
    if (!user) return [];
    const skipKeys = ['nik_decrypted', 'password_decrypted', 'nama', 'departemen', 'id_user', 'password'];
    return Object.entries(user)
      .filter(([key]) => !skipKeys.includes(key))
      .filter(([key]) => key.replace(/_/g, ' ').toLowerCase().includes(detailSearch.toLowerCase()));
  };

  const exportToExcel = () => {
    const exportData = processedUsers.map(u => {
      const skipKeys = ['nik_decrypted', 'password_decrypted', 'nama', 'departemen', 'id_user', 'password'];
      const activeRights = Object.entries(u)
        .filter(([key, val]) => val === 'true' && !skipKeys.includes(key))
        .map(([key]) => key.replace(/_/g, ' ').toUpperCase())
        .join(', ');

      return {
        'NIK': u.nik_decrypted,
        'Nama Pegawai': u.nama,
        'Departemen': u.departemen,
        'Hak Akses Aktif (Lengkap)': activeRights
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "User SIKKRW Lengkap");
    
    // Styling
    worksheet['!cols'] = [{wch: 15}, {wch: 30}, {wch: 25}, {wch: 120}];
    
    XLSX.writeFile(workbook, `SIKKRW_Lengkap_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("Excel Lengkap berhasil diekspor");
  };

  const exportSummaryExcel = () => {
    const groupDefinitions: Record<string, string[]> = {
      'ADMINISTRASI': ['user', 'mapping', 'master', 'setup', 'display', 'pengaturan', 'password', 'login', 'akses', 'display', 'set_harga', 'set_tarif', 'integrasi', 'template', 'sesuai'],
      'BPJS / ASURANSI': ['bpjs', 'inhealth', 'asuransi', 'sep', 'bridging', 'pcare', 'icare', 'jasaraharja', 'jkn', 'aplicare', 'inacbg', 'pcare'],
      'FARMASI / OBAT': ['obat', 'apotek', 'resep', 'farmasi', 'racik', 'telaah', 'alkes', 'bhp', 'narkoba'],
      'KEUANGAN / KASIR': ['bayar', 'pembayaran', 'piutang', 'hutang', 'keuangan', 'kasir', 'akun', 'rekening', 'tarif', 'billing', 'cashflow', 'jurnal', 'biaya', 'deposit', 'jasa', 'briapi', 'briva', 'bank', 'omset', 'validasi', 'pendapatan', 'zis'],
      'RAWAT JALAN / POLI': ['ralan', 'poli', 'skdp', 'triase', 'skrining', 'hemodialisa', 'mcu', 'fisioterapi', 'rehab', 'wicara', 'okupasi', 'kfr'],
      'RAWAT INAP / BANGSAL': ['ranap', 'bangsal', 'kamar', 'inap', 'meows', 'pews', 'ews', 'askep', 'diet', 'cairan', 'klasifikasi_pasien', 'nicu', 'picu', 'hcu', 'icu', 'kebidanan', 'neonatus', 'postpartum', 'aldrette', 'steward', 'bromage'],
      'IGD': ['igd', 'triase_igd', 'observasi_igd', 'gawat_darurat'],
      'TINDAKAN & OPERASI': ['tindakan', 'operasi', 'bedah', 'eswl', 'anestesi', 'pre_op', 'post_op', 'signin', 'timeout', 'signout', 'checklist_pre', 'checklist_post'],
      'LAB & RADIOLOGI': ['lab', 'radiologi', 'rontgen', 'ekg', 'usg', 'pa', 'mb', 'slit', 'echo', 'oct', 'sampel', 'bakumutu', 'specimen', 'diagnosticreport', 'servicerequest'],
      'REKAM MEDIS': ['resume', 'diagnosa', 'diagnosis', 'berkas_digital', 'data_rm', 'icd9', 'retensi', 'peminjaman_berkas', 'catatan_perawatan', 'catatan_keperawatan', 'observasi', 'follow_up', 'adime', 'pews', 'icare'],
      'KEPEGAWAIAN': ['pegawai', 'jabatan', 'pendidikan', 'kepegawaian', 'cuti', 'gaji', 'ilmiah', 'penghargaan', 'penelitian', 'berkas', 'peringatan', 'absensi', 'presensi', 'keterlambatan'],
      'INVENTARIS & IPSRS': ['inventaris', 'ipsrs', 'aset', 'pengadaan', 'gedung', 'perbaikan', 'pemeliharaan', 'non_medis', 'barang', 'suplier', 'stok', 'opname', 'pembelian', 'faktur', 'vendor', 'pengajuan_barang'],
      'SURAT MENYURAT': ['surat', 'indeks', 'klasifikasi', 'arsip', 'sakit', 'hamil', 'sehat', 'bebas', 'keterangan', 'pri', 'spri', 'skdp', 'rujukan', 'pernyataan', 'persetujuan', 'penolakan'],
      'UTILITAS SISTEM': ['barcode', 'sms', 'sidikjari', 'jam_masuk', 'jam_pulang', 'display', 'parkir', 'koneksi', 'database', 'audit_kepatuhan', 'audit_bundle', 'audit_fasilitas'],
      'FITUR PENDUKUNG': ['utd', 'donor', 'zis', 'toko', 'dapur', 'perpustakaan', 'sisrute', 'satu_sehat', 'limbah', 'pdam', 'pest_control', 'air_tanah', 'peminjam_piutang']
    };

    const categoryNames = Object.keys(groupDefinitions).sort();

    const exportData = processedUsers.map(u => {
      const skipKeys = ['nik_decrypted', 'password_decrypted', 'nama', 'departemen', 'id_user', 'password'];
      const activeKeys = Object.entries(u)
        .filter(([key, val]) => val === 'true' && !skipKeys.includes(key))
        .map(([key]) => key.toLowerCase());

      // Create row with basic info
      const row: any = {
        'NIK': u.nik_decrypted,
        'Nama Pegawai': u.nama,
        'Departemen': u.departemen,
      };

      // Create a column for each category
      categoryNames.forEach(cat => {
        const keywords = groupDefinitions[cat];
        // Find which specific keywords from this category are active for this user
        const matchedKeywords = keywords.filter(kw => 
          activeKeys.some(key => key.includes(kw))
        );

        if (matchedKeywords.length > 0) {
          // Format: "BPJS (SEP, VCLAIM, PCARE)" - only showing the matching keywords
          const displayKeywords = matchedKeywords
            .map(kw => kw.toUpperCase())
            .slice(0, 8); // Limit to top 8 sub-features to keep it neat
          
          row[cat] = `${cat} [${displayKeywords.join(', ')}]`;
        } else {
          row[cat] = '-';
        }
      });

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Ringkasan User SIKKRW");
    
    // Set column widths
    const wscols = [
      {wch: 15}, {wch: 30}, {wch: 25}, 
      ...categoryNames.map(() => ({wch: 20}))
    ];
    worksheet['!cols'] = wscols;
    
    XLSX.writeFile(workbook, `SIKKRW_Ringkas_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("Excel Ringkas berhasil diekspor");
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary animate-scale-in" />
            User SIKKRW
          </h1>
          <p className="text-muted-foreground text-sm font-medium">Monitoring Akun & Hak Akses Sistem Informasi Khanza.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            onClick={exportSummaryExcel} 
            variant="default" 
            className="gap-2 bg-primary text-primary-foreground hover:opacity-90 transition-all rounded-2xl font-bold shadow-card h-11 px-5"
          >
            <Settings2 className="w-4 h-4" />
            Export Ringkas
          </Button>
          <Button 
            onClick={exportToExcel} 
            variant="outline" 
            className="gap-2 bg-card border border-border hover:bg-success/5 hover:text-success hover:border-success/30 transition-all duration-200 rounded-2xl font-bold shadow-card h-11 px-5"
          >
            <Download className="w-4 h-4" />
            Export Lengkap
          </Button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-card p-4 rounded-2xl border border-border shadow-card hover:shadow-elevated transition-all duration-200 animate-slide-up">
        <div className="md:col-span-5 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Cari NIK, Nama, atau Dept..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-11 h-11 border-border focus:ring-ring"
          />
        </div>
        
        <div className="md:col-span-4 flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="h-11 border-border rounded-2xl focus:ring-ring">
              <SelectValue placeholder="Filter Departemen" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-border shadow-float">
              <SelectItem value="all">Semua Departemen</SelectItem>
              {departments.map(d => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
 
        <div className="md:col-span-3 flex justify-end">
           <Button 
             variant="outline" 
             onClick={toggleSort}
             className={`h-11 rounded-2xl gap-2 w-full justify-between px-4 border transition-all duration-200 ${sortOrder !== 'none' ? 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/15' : 'bg-card border-border hover:bg-accent'}`}
           >
             <span className="text-sm font-semibold">Urutkan Dept</span>
             {sortOrder === 'none' && <ArrowUpDown className="w-4 h-4 opacity-50" />}
             {sortOrder === 'asc' && <ArrowUp className="w-4 h-4" />}
             {sortOrder === 'desc' && <ArrowDown className="w-4 h-4" />}
           </Button>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-card hover:shadow-elevated transition-all duration-200 overflow-hidden animate-slide-up">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30 border-b border-border">
              <TableRow>
                <TableHead className="w-12 font-bold text-xs text-muted-foreground">No</TableHead>
                <TableHead className="w-40 font-bold text-xs text-muted-foreground">NIK</TableHead>
                <TableHead className="font-bold text-xs text-muted-foreground">Nama Pegawai</TableHead>
                <TableHead className="cursor-pointer hover:text-primary font-bold text-xs text-muted-foreground" onClick={toggleSort}>
                  <div className="flex items-center gap-1.5">
                    Departemen
                    {sortOrder !== 'none' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />)}
                  </div>
                </TableHead>
                <TableHead className="font-bold text-xs text-muted-foreground">Password</TableHead>
                <TableHead className="text-right font-bold text-xs text-muted-foreground">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i} className="border-b border-border">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded"></div></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : processedUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    Data tidak ditemukan.
                  </TableCell>
                </TableRow>
              ) : (
                processedUsers.map((user, idx) => (
                  <TableRow key={idx} className="hover:bg-muted/10 border-b border-border transition-colors group">
                    <TableCell className="text-muted-foreground text-[11px] font-medium">{idx + 1}</TableCell>
                    <TableCell>
                      <span className="font-mono text-xs font-bold text-foreground bg-muted px-2 py-0.5 rounded-lg border border-border">{user.nik_decrypted || '---'}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-primary" />
                        <span className="font-semibold text-foreground text-xs">{user.nama || '---'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building className="w-3.5 h-3.5 text-muted-foreground/60" />
                        <span className="text-xs text-muted-foreground font-medium">{user.departemen || '---'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 font-mono text-xs">
                        {showPasswords[idx] ? (
                          <span className="text-primary bg-primary/10 font-bold px-2.5 py-0.5 rounded-lg border border-primary/20">{user.password_decrypted}</span>
                        ) : (
                          <span className="text-muted-foreground/45 tracking-widest font-sans font-bold">••••••••</span>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 ml-0.5 hover:bg-primary/10 hover:text-primary transition-all duration-200"
                          onClick={() => togglePassword(idx)}
                        >
                          {showPasswords[idx] ? <EyeOff className="w-3 h-3 text-primary" /> : <Eye className="w-3 h-3 text-muted-foreground/70" />}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                       <Button 
                         variant="outline" 
                         size="sm" 
                         className="text-xs h-9 gap-1.5 bg-card border border-border hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-200 rounded-xl font-bold shadow-card"
                         onClick={() => setSelectedUser(user)}
                       >
                         <Settings2 className="w-3.5 h-3.5" />
                         Hak Akses
                       </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Dialog Hak Akses */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col rounded-2xl border border-border bg-card shadow-float">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
              <Settings2 className="w-5 h-5 text-primary" />
              Detail Hak Akses: {selectedUser?.nama}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              NIK: {selectedUser?.nik_decrypted} | Dept: {selectedUser?.departemen}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between mt-2 gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Cari hak akses..." 
                value={detailSearch}
                onChange={(e) => setDetailSearch(e.target.value)}
                className="pl-11 h-11 text-sm border-border"
              />
            </div>
            <div className="px-3.5 py-1.5 bg-primary/10 text-primary rounded-full text-[10px] font-bold border border-primary/20 whitespace-nowrap uppercase tracking-wider">
              {getPermissions(selectedUser).length} / {selectedUser ? Object.keys(selectedUser).length - 6 : 0} ITEM
            </div>
          </div>

          <div className="flex-1 mt-4 pr-2 border-t border-border pt-4 overflow-y-auto custom-scrollbar" style={{ maxHeight: '60vh' }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5">
              {selectedUser && getPermissions(selectedUser).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between py-1.5 border-b border-border/40 group hover:bg-muted/40 px-2 rounded-lg transition-colors">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate mr-2" title={key}>
                    {key.replace(/_/g, ' ')}
                  </span>
                  <Badge 
                    variant={value === 'true' ? 'default' : 'secondary'}
                    className={`text-[9px] py-0 px-2 h-5 min-w-[40px] justify-center rounded-md font-bold ${
                      value === 'true' 
                        ? 'bg-success/15 text-success border border-success/20 hover:bg-success/20 shadow-card' 
                        : 'bg-muted text-muted-foreground/60 border border-border/80 hover:bg-muted shadow-sm'
                    }`}
                  >
                    {value === 'true' ? 'YES' : 'NO'}
                  </Badge>
                </div>
              ))}
            </div>
            <div className="h-10"></div> {/* Spacer bottom */}
          </div>
          
          <div className="mt-4 pt-4 border-t border-border flex justify-end">
            <Button variant="secondary" onClick={() => setSelectedUser(null)} className="h-11 px-6 rounded-2xl font-bold">
              Tutup
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SikkUsers;
