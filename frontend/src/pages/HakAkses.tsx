import { useState, useEffect, useMemo, useCallback } from "react";
import { authFetch } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  Users,
  Search,
  Filter,
  RefreshCw,
  Edit,
  RotateCcw,
  CheckCircle2,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { DEPARTEMEN_LIST } from "@/data/mockData";

interface UserRoleItem {
  nik: string;
  nama: string;
  jk: string;
  jbtn: string;
  departemen: string;
  stts_aktif: string;
  role: "IT" | "HRD" | "STAFF";
  isCustom: boolean;
  keterangan: string | null;
  updated_by: string | null;
  updated_at: string | null;
}

interface RoleStats {
  total: number;
  itCount: number;
  hrdCount: number;
  staffCount: number;
}

export default function HakAkses() {
  const [users, setUsers] = useState<UserRoleItem[]>([]);
  const [stats, setStats] = useState<RoleStats>({
    total: 0,
    itCount: 0,
    hrdCount: 0,
    staffCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");

  // Dialog Edit Role State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRoleItem | null>(null);
  const [newRole, setNewRole] = useState<"IT" | "HRD" | "STAFF">("STAFF");
  const [keterangan, setKeterangan] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Fetch roles list
  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.append("search", search.trim());
      if (roleFilter !== "all") params.append("roleFilter", roleFilter);
      if (deptFilter !== "all") params.append("deptFilter", deptFilter);

      const res = await authFetch(`/api/roles?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setUsers(data.data || []);
        if (data.stats) setStats(data.stats);
      } else {
        toast.error(data.message || "Gagal mengambil data hak akses");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Terjadi kesalahan saat memuat data hak akses");
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, deptFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRoles();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchRoles]);

  // Open edit modal
  const handleEditRole = (user: UserRoleItem) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setKeterangan(user.keterangan || "");
    setDialogOpen(true);
  };

  // Submit role update
  const handleSaveRole = async () => {
    if (!selectedUser) return;
    try {
      setSubmitting(true);
      const res = await authFetch("/api/roles", {
        method: "POST",
        body: JSON.stringify({
          nik: selectedUser.nik,
          role: newRole,
          keterangan: keterangan.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setDialogOpen(false);
        fetchRoles();
      } else {
        toast.error(data.message || "Gagal memperbarui hak akses");
      }
    } catch (err) {
      console.error(err);
      toast.error("Gagal memperbarui hak akses ke server");
    } finally {
      setSubmitting(false);
    }
  };

  // Reset to default
  const handleResetRole = async (user: UserRoleItem) => {
    if (!confirm(`Reset hak akses ${user.nama} (${user.nik}) kembali ke default departemen?`)) {
      return;
    }

    try {
      const res = await authFetch(`/api/roles/${user.nik}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchRoles();
      } else {
        toast.error(data.message || "Gagal mereset hak akses");
      }
    } catch (err) {
      console.error(err);
      toast.error("Gagal mereset hak akses");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in p-2 md:p-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-indigo-600" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Manajemen Hak Akses Aplikasi
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Pengaturan peran pengguna khusus untuk aplikasi absensi ini. Tidak mempengaruhi SIMRS Khanza.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchRoles()}
          disabled={loading}
          className="self-start md:self-auto gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Info Banner */}
      <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 text-sm text-indigo-900 dark:text-indigo-200 flex items-start gap-3">
        <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Aturan Hak Akses:</span>
          <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs md:text-sm text-indigo-800 dark:text-indigo-300">
            <li>
              <span className="font-medium text-indigo-950 dark:text-indigo-100">IT</span>: Hak akses penuh. Mengatur hak akses, Laporan Departemen, Sinkronisasi, dan melihat seluruh absensi.
            </li>
            <li>
              <span className="font-medium text-emerald-800 dark:text-emerald-300">HRD</span>: Dapat melihat seluruh data absensi dan lembur semua karyawan.
            </li>
            <li>
              <span className="font-medium text-slate-800 dark:text-slate-200">Staff</span>: Hanya dapat melihat data absensinya sendiri di aplikasi.
            </li>
          </ul>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Pegawai</p>
              <h3 className="text-2xl font-bold mt-1">{stats.total}</h3>
            </div>
            <div className="p-2.5 rounded-xl bg-muted text-foreground">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-indigo-200/60 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/20 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Peran IT</p>
              <h3 className="text-2xl font-bold mt-1 text-indigo-700 dark:text-indigo-400">
                {stats.itCount}
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200/60 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Peran HRD</p>
              <h3 className="text-2xl font-bold mt-1 text-emerald-700 dark:text-emerald-400">
                {stats.hrdCount}
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">
              <UserCheck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Peran Staff</p>
              <h3 className="text-2xl font-bold mt-1">{stats.staffCount}</h3>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Search */}
      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama atau NIK..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="w-[160px] h-9 text-xs">
                  <SelectValue placeholder="Departemen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Departemen</SelectItem>
                  {DEPARTEMEN_LIST.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[140px] h-9 text-xs">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Role</SelectItem>
                  <SelectItem value="IT">Role IT</SelectItem>
                  <SelectItem value="HRD">Role HRD</SelectItem>
                  <SelectItem value="STAFF">Role Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table List */}
      <Card className="border-border/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[120px]">NIK</TableHead>
                <TableHead>Nama Pegawai</TableHead>
                <TableHead>Departemen / Jabatan</TableHead>
                <TableHead className="w-[140px]">Hak Akses</TableHead>
                <TableHead className="w-[160px]">Status Kustom</TableHead>
                <TableHead className="text-right w-[140px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 opacity-50" />
                    Memuat data hak akses...
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    Tidak ada pegawai yang sesuai dengan filter.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.nik} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-xs font-semibold">
                      {u.nik}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm text-foreground">{u.nama}</div>
                      <div className="text-xs text-muted-foreground">
                        {u.jk === "L" ? "Laki-laki" : "Perempuan"} • {u.stts_aktif}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-xs">{u.departemen}</div>
                      <div className="text-xs text-muted-foreground">{u.jbtn}</div>
                    </TableCell>
                    <TableCell>
                      {u.role === "IT" && (
                        <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1 px-2 py-0.5">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          IT
                        </Badge>
                      )}
                      {u.role === "HRD" && (
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 px-2 py-0.5">
                          <UserCheck className="w-3.5 h-3.5" />
                          HRD
                        </Badge>
                      )}
                      {u.role === "STAFF" && (
                        <Badge variant="secondary" className="text-muted-foreground font-normal px-2 py-0.5">
                          Staff
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.isCustom ? (
                        <span className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                          Kustom {u.keterangan ? `(${u.keterangan})` : ""}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Default (Dept: {u.departemen})
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditRole(u)}
                          className="h-8 px-2 text-xs gap-1 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/50"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          Ubah
                        </Button>
                        {u.isCustom && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResetRole(u)}
                            className="h-8 px-2 text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                            title="Reset ke default departemen"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Edit Role Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              Ubah Hak Akses Pengguna
            </DialogTitle>
            <DialogDescription>
              Tentukan hak akses untuk aplikasi absensi bagi karyawan ini.
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-muted/60 text-sm space-y-1">
                <div className="font-semibold text-foreground">{selectedUser.nama}</div>
                <div className="text-xs text-muted-foreground">
                  NIK: <span className="font-mono">{selectedUser.nik}</span> • Departemen:{" "}
                  <span className="font-medium">{selectedUser.departemen}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role-select">Pilih Peran (Role)</Label>
                <Select
                  value={newRole}
                  onValueChange={(val: any) => setNewRole(val)}
                >
                  <SelectTrigger id="role-select">
                    <SelectValue placeholder="Pilih Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STAFF">
                      <div className="flex flex-col py-0.5">
                        <span className="font-medium">Staff (User Biasa)</span>
                        <span className="text-xs text-muted-foreground">
                          Hanya dapat melihat data absensi miliknya sendiri
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="HRD">
                      <div className="flex flex-col py-0.5">
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          HRD
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Dapat melihat data absensi seluruh karyawan rumah sakit
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="IT">
                      <div className="flex flex-col py-0.5">
                        <span className="font-medium text-indigo-600 dark:text-indigo-400">
                          IT (Super Admin)
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Hak penuh: Atur hak akses, Laporan Dept, Sinkronisasi, dan seluruh absensi
                        </span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="keterangan-input">Catatan / Keterangan (Opsional)</Label>
                <Input
                  id="keterangan-input"
                  placeholder="Misal: Penugasan khusus HR / IT Support"
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button
              onClick={handleSaveRole}
              disabled={submitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {submitting ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
