import { useState, useEffect, useMemo } from "react";
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
      const res = await fetch("http://localhost:3103/api/pegawai/sikk-users");
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
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">User SIKKRW</h1>
          <p className="text-slate-500 font-medium">Monitoring Akun & Hak Akses Sistem Informasi Khanza.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            onClick={exportSummaryExcel} 
            variant="default" 
            className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-sm"
          >
            <Settings2 className="w-4 h-4" />
            Export Ringkas
          </Button>
          <Button 
            onClick={exportToExcel} 
            variant="outline" 
            className="gap-2 bg-white hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            Export Lengkap
          </Button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="md:col-span-5 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Cari NIK, Nama, atau Dept..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 border-slate-200 focus:border-blue-400"
          />
        </div>
        
        <div className="md:col-span-4 flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="h-10 border-slate-200">
              <SelectValue placeholder="Filter Departemen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Departemen</SelectItem>
              {departments.map(d => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-3 flex justify-end">
           <Button 
             variant="ghost" 
             onClick={toggleSort}
             className={`h-10 gap-2 w-full justify-between px-4 border ${sortOrder !== 'none' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'border-slate-200 text-slate-600'}`}
           >
             <span className="text-sm">Urutkan Dept</span>
             {sortOrder === 'none' && <ArrowUpDown className="w-4 h-4 opacity-50" />}
             {sortOrder === 'asc' && <ArrowUp className="w-4 h-4" />}
             {sortOrder === 'desc' && <ArrowDown className="w-4 h-4" />}
           </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="w-12">No</TableHead>
                <TableHead className="w-40">NIK</TableHead>
                <TableHead>Nama Pegawai</TableHead>
                <TableHead className="cursor-pointer hover:text-blue-600" onClick={toggleSort}>
                  <div className="flex items-center gap-1.5">
                    Departemen
                    {sortOrder !== 'none' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                  </div>
                </TableHead>
                <TableHead>Password</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><div className="h-4 bg-slate-100 animate-pulse rounded"></div></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : processedUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                    Data tidak ditemukan.
                  </TableCell>
                </TableRow>
              ) : (
                processedUsers.map((user, idx) => (
                  <TableRow key={idx} className="hover:bg-slate-50/50 transition-colors group">
                    <TableCell className="text-slate-400 text-[11px]">{idx + 1}</TableCell>
                    <TableCell>
                      <span className="font-mono text-sm font-bold text-slate-700 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{user.nik_decrypted || '---'}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-blue-500" />
                        <span className="font-semibold text-slate-800">{user.nama || '---'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-sm text-slate-600">{user.departemen || '---'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 font-mono text-xs">
                        {showPasswords[idx] ? (
                          <span className="text-slate-800 bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded border border-blue-100">{user.password_decrypted}</span>
                        ) : (
                          <span className="text-slate-300">••••••••</span>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 ml-0.5 hover:bg-blue-50"
                          onClick={() => togglePassword(idx)}
                        >
                          {showPasswords[idx] ? <EyeOff className="w-3 h-3 text-blue-600" /> : <Eye className="w-3 h-3 text-slate-400" />}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                       <Button 
                         variant="outline" 
                         size="sm" 
                         className="text-xs h-8 gap-1.5 bg-white group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all"
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
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-blue-600" />
              Detail Hak Akses: {selectedUser?.nama}
            </DialogTitle>
            <DialogDescription>
              NIK: {selectedUser?.nik_decrypted} | Dept: {selectedUser?.departemen}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between mt-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Cari hak akses..." 
                value={detailSearch}
                onChange={(e) => setDetailSearch(e.target.value)}
                className="pl-10 h-9 text-sm"
              />
            </div>
            <div className="ml-4 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold border border-blue-100 whitespace-nowrap">
              {getPermissions(selectedUser).length} / {selectedUser ? Object.keys(selectedUser).length - 6 : 0} ITEM
            </div>
          </div>

          <div className="flex-1 mt-4 pr-2 border-t border-slate-100 pt-4 overflow-y-auto custom-scrollbar" style={{ maxHeight: '60vh' }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
              {selectedUser && getPermissions(selectedUser).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between py-1 border-b border-slate-50/50 group hover:bg-slate-50 px-1 rounded transition-colors">
                  <span className="text-[10px] font-medium text-slate-500 uppercase tracking-tight truncate mr-2" title={key}>
                    {key.replace(/_/g, ' ')}
                  </span>
                  <Badge 
                    variant={value === 'true' ? 'default' : 'secondary'}
                    className={`text-[9px] py-0 px-1.5 h-4 min-w-[35px] justify-center ${value === 'true' ? 'bg-emerald-500' : 'bg-slate-100 text-slate-400'}`}
                  >
                    {value === 'true' ? 'YES' : 'NO'}
                  </Badge>
                </div>
              ))}
            </div>
            <div className="h-10"></div> {/* Spacer bottom */}
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
            <Button variant="secondary" onClick={() => setSelectedUser(null)}>
              Tutup
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SikkUsers;
