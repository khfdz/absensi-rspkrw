import { useState, useCallback, useEffect, useRef } from "react";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Search, Clock, CalendarDays, AlertTriangle, TrendingUp, User, 
  Timer, PhoneCall, Download, SlidersHorizontal, Settings2, Plus, 
  X, ChevronDown, ChevronUp, Calendar, ShieldCheck,
  Repeat, Sun, Sunset, Moon, Coffee, RotateCcw, Info, Wrench, CheckCircle2, Sparkles
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import dayjs from "dayjs";

// ─── Types ──────────────────────────────────────────────────────────────────
interface DailyEntry {
  tanggal: string;
  hari: string;
  jam_masuk: string | null;
  jam_pulang: string | null;
  shift_label: string;
  shift_mulai: string | null;
  shift_selesai: string | null;
  tipe: "NORMAL" | "LEMBUR" | "ON-CALL" | "TIDAK_LENGKAP";
  durasi_menit: number;
  detail: string;
  is_koreksi?: boolean;
}

interface PegawaiResult {
  pin: string;
  nama: string;
  departemen: string;
  daily: DailyEntry[];
}

interface PegawaiSuggestion {
  id: number;
  nik: string;
  nama: string;
  departemen: string;
  jbtn?: string;
  stts_aktif?: string;
}

interface ShiftOverride {
  shift: string;
  start?: string;
  end?: string;
  isOff?: boolean;
  label: string;
}

interface ManualCorrection {
  masuk: string;
  pulang: string;
  tipe: "LEMBUR" | "ON-CALL";
  detail: string;
}

export interface DailyScheduleItem {
  start: string;
  end: string;
  isOff: boolean;
}

export const DEFAULT_CUSTOM_SCHEDULE: Record<number, DailyScheduleItem> = {
  1: { start: "08:00", end: "16:00", isOff: false }, // Senin
  2: { start: "08:00", end: "16:00", isOff: false }, // Selasa
  3: { start: "08:00", end: "16:00", isOff: false }, // Rabu
  4: { start: "08:00", end: "16:00", isOff: false }, // Kamis
  5: { start: "08:00", end: "16:00", isOff: false }, // Jumat
  6: { start: "08:00", end: "13:00", isOff: false }, // Sabtu
  0: { start: "07:00", end: "14:00", isOff: true  }, // Minggu
};

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatDurasi(menit: number): string {
  if (menit <= 0) return "–";
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  if (jam > 0 && sisa > 0) return `${jam}j ${sisa}m`;
  if (jam > 0) return `${jam} jam`;
  return `${sisa} menit`;
}

// Default date range: 25th of last month to 25th of this month
function getDefaultDates() {
  const today = dayjs();
  const day25ThisMonth = today.date(25);
  const start = day25ThisMonth.subtract(1, "month").format("YYYY-MM-DD");
  const end = day25ThisMonth.format("YYYY-MM-DD");
  return { start, end };
}

const DAYS_OF_WEEK = [
  { id: 0, label: "Minggu" },
  { id: 1, label: "Senin" },
  { id: 2, label: "Selasa" },
  { id: 3, label: "Rabu" },
  { id: 4, label: "Kamis" },
  { id: 5, label: "Jumat" },
  { id: 6, label: "Sabtu" },
];

// ─── Component ───────────────────────────────────────────────────────────────
export default function LemburFinder() {
  const { toast } = useToast();
  const { user } = useAuth();
  const userRole = (user?.role || "STAFF") as "IT" | "HRD" | "STAFF";
  const isPrivileged = userRole === "IT" || userRole === "HRD";

  const defaults = getDefaultDates();

  const [nama, setNama] = useState(isPrivileged ? "" : (user?.nama || ""));
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PegawaiResult[]>([]);
  const [selectedPin, setSelectedPin] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // ─── Autocomplete / Saran Nama Pegawai States ───
  const [suggestions, setSuggestions] = useState<PegawaiSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [fetchingSuggestions, setFetchingSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // ─── Dynamic Rules States ───
  // Pola Jadwal: 'AUTO_PERAWAT' (Default) | 'NON_SHIFT' | 'CUSTOM'
  const [patternType, setPatternType] = useState<"AUTO_PERAWAT" | "NON_SHIFT" | "CUSTOM">("AUTO_PERAWAT");

  // Jam Jadwal Custom
  const [workStart, setWorkStart] = useState("08:00");
  const [workEnd, setWorkEnd] = useState("16:00");
  const [saturdayStart, setSaturdayStart] = useState("08:00");
  const [saturdayEnd, setSaturdayEnd] = useState("13:00");
  const [saturdayIsOff, setSaturdayIsOff] = useState(false);
  const [sundayStart, setSundayStart] = useState("07:00");
  const [sundayEnd, setSundayEnd] = useState("14:00");
  const [sundayIsOff, setSundayIsOff] = useState(false);

  // Jadwal Harian Kustom (Senin s/d Minggu diatur per hari)
  const [customDailySchedule, setCustomDailySchedule] = useState<Record<number, DailyScheduleItem>>(DEFAULT_CUSTOM_SCHEDULE);

  // Hari Libur
  const [holidayDays, setHolidayDays] = useState<number[]>([0]); // 0 = Minggu
  const [customHolidays, setCustomHolidays] = useState<string[]>([]);
  const [newHolidayInput, setNewHolidayInput] = useState("");

  // Opsi di Luar Jam Kerja: ON-CALL vs LEMBUR
  const [outsideShiftMode, setOutsideShiftMode] = useState<"ON-CALL" | "LEMBUR">("ON-CALL");

  // Tukar Jadwal Hari (Override per Tanggal)
  const [scheduleOverrides, setScheduleOverrides] = useState<Record<string, ShiftOverride>>({});

  // Koreksi Manual Fingerprint (Map per tanggal)
  const [manualCorrections, setManualCorrections] = useState<Record<string, ManualCorrection>>({});

  // ─── Modal Koreksi Absen State ───
  const [koreksiOpen, setKoreksiOpen] = useState(false);
  const [koreksiDate, setKoreksiDate] = useState("");
  const [koreksiHari, setKoreksiHari] = useState("");
  const [koreksiShiftLabel, setKoreksiShiftLabel] = useState("");
  const [koreksiMasuk, setKoreksiMasuk] = useState("");
  const [koreksiPulang, setKoreksiPulang] = useState("");
  const [koreksiTipe, setKoreksiTipe] = useState<"LEMBUR" | "ON-CALL">("LEMBUR");
  const [koreksiDetail, setKoreksiDetail] = useState("Koreksi salah pencet status tombol fingerprint saat pulang");
  const [detectedPairSuggestions, setDetectedPairSuggestions] = useState<{ masuk: string; pulang: string } | null>(null);

  // Panel settings visibility
  const [showRulesSettings, setShowRulesSettings] = useState(true);

  useEffect(() => {
    if (!isPrivileged && user?.nama) {
      setNama(user.nama);
    }
  }, [isPrivileged, user]);

  // Debounce fetch untuk saran nama pegawai
  useEffect(() => {
    if (!isPrivileged) return;
    const query = nama.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setFetchingSuggestions(true);
        const res = await authFetch(`/api/pegawai?search=${encodeURIComponent(query)}&limit=8`);
        const json = await res.json();
        if (json.success) {
          setSuggestions(json.data || []);
          setShowSuggestions((json.data || []).length > 0);
        }
      } catch (err) {
        console.error("Error fetching pegawai suggestions:", err);
      } finally {
        setFetchingSuggestions(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [nama, isPrivileged]);

  // Klik di luar dropdown untuk menutup saran nama
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectSuggestion = (pegawai: PegawaiSuggestion) => {
    setNama(pegawai.nama);
    setShowSuggestions(false);
    executeSearch(undefined, undefined, pegawai.nama);
  };

  const addCustomHoliday = () => {
    if (!newHolidayInput) return;
    if (customHolidays.includes(newHolidayInput)) {
      toast({ title: "Perhatian", description: "Tanggal libur ini sudah ada di daftar.", variant: "destructive" });
      return;
    }
    setCustomHolidays(prev => [...prev, newHolidayInput].sort());
    setNewHolidayInput("");
  };

  const removeCustomHoliday = (dateStr: string) => {
    setCustomHolidays(prev => prev.filter(d => d !== dateStr));
  };

  const toggleHolidayDay = (dayNum: number) => {
    setHolidayDays(prev => 
      prev.includes(dayNum) ? prev.filter(d => d !== dayNum) : [...prev, dayNum]
    );
  };

  // Perform search with custom overrides & manual corrections support
  const executeSearch = useCallback(async (
    overridesToUse?: Record<string, ShiftOverride>,
    correctionsToUse?: Record<string, ManualCorrection>,
    targetNamaOverride?: string
  ) => {
    const rawTarget = targetNamaOverride !== undefined ? targetNamaOverride : (isPrivileged ? nama.trim() : (user?.nama || user?.nik || ""));
    const searchTarget = rawTarget.trim();

    if (!searchTarget) {
      toast({ title: "Peringatan", description: "Masukkan nama pegawai terlebih dahulu.", variant: "destructive" });
      return;
    }
    if (!startDate || !endDate) {
      toast({ title: "Peringatan", description: "Rentang tanggal harus diisi.", variant: "destructive" });
      return;
    }
    try {
      setLoading(true);
      setHasSearched(true);

      const activeOverrides = overridesToUse !== undefined ? overridesToUse : scheduleOverrides;
      const activeCorrections = correctionsToUse !== undefined ? correctionsToUse : manualCorrections;

      const params = new URLSearchParams({
        nama: searchTarget,
        startDate,
        endDate,
        patternType,
        workStart,
        workEnd,
        saturdayStart,
        saturdayEnd,
        saturdayIsOff: String(saturdayIsOff),
        sundayStart,
        sundayEnd,
        sundayIsOff: String(sundayIsOff),
        holidayDays: holidayDays.join(','),
        customHolidays: customHolidays.join(','),
        outsideShiftMode,
        scheduleOverrides: JSON.stringify(activeOverrides),
        manualCorrections: JSON.stringify(activeCorrections),
        customDailySchedule: JSON.stringify(customDailySchedule)
      });

      const res = await authFetch(`/api/absensi/lembur-finder?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setResults(json.data || []);
        if ((json.data || []).length === 1) setSelectedPin(json.data[0].pin);
        if ((json.data || []).length === 0) {
          toast({ title: "Tidak Ditemukan", description: `Pegawai "${searchTarget}" tidak ditemukan di database.` });
        }
      } else {
        toast({ title: "Error", description: json.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Gagal", description: "Tidak bisa terhubung ke server.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [
    nama, startDate, endDate, toast, isPrivileged, user,
    patternType, workStart, workEnd, saturdayStart, saturdayEnd, saturdayIsOff,
    sundayStart, sundayEnd, sundayIsOff, holidayDays, customHolidays,
    outsideShiftMode, scheduleOverrides, manualCorrections, customDailySchedule
  ]);

  const handleSearch = () => {
    executeSearch();
  };

  // Handler Tukar Jadwal per Hari
  const handleSwapShift = (tanggal: string, newShiftType: string) => {
    let updated: Record<string, ShiftOverride>;

    if (newShiftType === "RESET") {
      updated = { ...scheduleOverrides };
      delete updated[tanggal];
      toast({ title: "Jadwal Direset", description: `Tanggal ${tanggal} kembali ke jadwal sistem.` });
    } else if (newShiftType === "PAGI") {
      updated = {
        ...scheduleOverrides,
        [tanggal]: { shift: "PAGI", start: "07:00", end: "14:00", label: "Shift Pagi" }
      };
      toast({ title: "Tukar Jadwal", description: `Tanggal ${tanggal} ditukar ke Shift Pagi (07:00–14:00).` });
    } else if (newShiftType === "SIANG") {
      updated = {
        ...scheduleOverrides,
        [tanggal]: { shift: "SIANG", start: "14:00", end: "21:00", label: "Shift Siang" }
      };
      toast({ title: "Tukar Jadwal", description: `Tanggal ${tanggal} ditukar ke Shift Siang (14:00–21:00).` });
    } else if (newShiftType === "MALAM") {
      updated = {
        ...scheduleOverrides,
        [tanggal]: { shift: "MALAM", start: "21:00", end: "07:00", label: "Shift Malam" }
      };
      toast({ title: "Tukar Jadwal", description: `Tanggal ${tanggal} ditukar ke Shift Malam (21:00–07:00).` });
    } else if (newShiftType === "KANTOR") {
      updated = {
        ...scheduleOverrides,
        [tanggal]: { shift: "KANTOR", start: "08:00", end: "16:00", label: "Kantor" }
      };
      toast({ title: "Tukar Jadwal", description: `Tanggal ${tanggal} ditukar ke Jam Kantor (08:00–16:00).` });
    } else if (newShiftType === "OFF") {
      updated = {
        ...scheduleOverrides,
        [tanggal]: { shift: "OFF", isOff: true, label: "Tukar Libur" }
      };
      toast({ title: "Tukar Jadwal", description: `Tanggal ${tanggal} ditukar menjadi Hari Libur (Off).` });
    } else {
      return;
    }

    setScheduleOverrides(updated);
    executeSearch(updated, manualCorrections);
  };

  const selectedPegawai = results.find(r => r.pin === selectedPin) ?? null;

  // Buka Modal Koreksi Absen
  const openCorrectionDialog = (d: DailyEntry) => {
    setKoreksiDate(d.tanggal);
    setKoreksiHari(d.hari);
    setKoreksiShiftLabel(d.shift_label);

    const existing = manualCorrections[d.tanggal];
    if (existing) {
      setKoreksiMasuk(existing.masuk);
      setKoreksiPulang(existing.pulang);
      setKoreksiTipe(existing.tipe);
      setKoreksiDetail(existing.detail);
      setDetectedPairSuggestions(null);
    } else {
      // Cari jika ada baris lain pada tanggal yang sama (kasus 07:14 dan 01:03 terpisah)
      const sameDayRows = selectedPegawai?.daily.filter(item => item.tanggal === d.tanggal) || [];
      const timesOnDay = sameDayRows
        .map(r => r.jam_masuk || r.jam_pulang)
        .filter((t): t is string => Boolean(t));

      if (timesOnDay.length >= 2) {
        // Otomatis pasangkan tap paling awal dan paling akhir!
        setKoreksiMasuk(timesOnDay[0]);
        setKoreksiPulang(timesOnDay[timesOnDay.length - 1]);
        setDetectedPairSuggestions({ masuk: timesOnDay[0], pulang: timesOnDay[timesOnDay.length - 1] });
      } else {
        setKoreksiMasuk(d.jam_masuk || "07:00");
        setKoreksiPulang(d.jam_pulang || "16:00");
        setDetectedPairSuggestions(null);
      }

      setKoreksiTipe(d.tipe === "ON-CALL" ? "ON-CALL" : "LEMBUR");
      setKoreksiDetail("Koreksi salah tekan tombol mesin absen (pulang jam " + (timesOnDay[1] || d.jam_pulang || "") + ")");
    }

    setKoreksiOpen(true);
  };

  // Simpan Koreksi Manual
  const handleSaveCorrection = () => {
    if (!koreksiMasuk || !koreksiPulang) {
      toast({ title: "Peringatan", description: "Jam masuk dan jam pulang harus diisi.", variant: "destructive" });
      return;
    }

    const updated = {
      ...manualCorrections,
      [koreksiDate]: {
        masuk: koreksiMasuk,
        pulang: koreksiPulang,
        tipe: koreksiTipe,
        detail: koreksiDetail.trim() || `Koreksi manual fingerprint: Masuk ${koreksiMasuk}, Pulang ${koreksiPulang}`
      }
    };

    setManualCorrections(updated);
    setKoreksiOpen(false);
    toast({ 
      title: "Koreksi Berhasil Disimpan", 
      description: `Tanggal ${koreksiDate} dikoreksi menjadi ${koreksiMasuk} – ${koreksiPulang} (${koreksiTipe}).` 
    });

    executeSearch(scheduleOverrides, updated);
  };

  // Reset Koreksi Manual ke data asli mesin
  const handleResetCorrection = () => {
    const updated = { ...manualCorrections };
    delete updated[koreksiDate];
    setManualCorrections(updated);
    setKoreksiOpen(false);
    toast({ title: "Koreksi Dihapus", description: `Tanggal ${koreksiDate} dikembalikan ke data mesin absensi asli.` });
    executeSearch(scheduleOverrides, updated);
  };

  // Summary stats
  const summary = selectedPegawai
    ? selectedPegawai.daily.reduce(
        (acc, d) => {
          if (d.tipe === "LEMBUR") {
            acc.totalLemburMenit += d.durasi_menit;
            acc.hariLembur++;
          } else if (d.tipe === "ON-CALL") {
            acc.totalOnCallMenit += d.durasi_menit;
            acc.hariOnCall++;
          }
          return acc;
        },
        { totalLemburMenit: 0, hariLembur: 0, totalOnCallMenit: 0, hariOnCall: 0 }
      )
    : null;

  const exportCSV = () => {
    if (!selectedPegawai) return;
    const headers = "Tanggal,Hari,Jam Masuk,Jam Pulang,Shift,Tipe,Durasi,Keterangan\n";
    const rows = selectedPegawai.daily
      .filter(d => d.tipe !== "NORMAL")
      .map(d =>
        `${d.tanggal},${d.hari},${d.jam_masuk || "-"},${d.jam_pulang || "-"},${d.shift_label},${d.tipe},${formatDurasi(d.durasi_menit)},"${d.detail}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lembur_finder_${selectedPegawai.nama.replace(/\s+/g, "_")}_${startDate}_${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "Berhasil", description: "Data lembur berhasil diexport." });
  };

  // Badge per tipe
  const tipeBadge = (tipe: DailyEntry["tipe"]) => {
    switch (tipe) {
      case "LEMBUR":
        return (
          <Badge variant="outline" className="bg-warning/10 text-warning border border-warning/20 font-bold text-[10px] tracking-wider rounded-full px-2.5 py-0.5 gap-1.5 shadow-sm inline-flex items-center">
            <TrendingUp className="w-3 h-3" /> LEMBUR
          </Badge>
        );
      case "ON-CALL":
        return (
          <Badge variant="outline" className="bg-info/10 text-info border border-info/20 font-bold text-[10px] tracking-wider rounded-full px-2.5 py-0.5 gap-1.5 shadow-sm inline-flex items-center">
            <PhoneCall className="w-3 h-3" /> ON-CALL
          </Badge>
        );
      case "TIDAK_LENGKAP":
        return (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border border-destructive/20 font-bold text-[10px] tracking-wider rounded-full px-2.5 py-0.5 gap-1.5 shadow-sm inline-flex items-center">
            <AlertTriangle className="w-3 h-3" /> TIDAK LENGKAP
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-success/10 text-success border border-success/20 font-bold text-[10px] tracking-wider rounded-full px-2.5 py-0.5 shadow-sm inline-flex items-center">
            NORMAL
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Timer className="w-6 h-6 text-primary animate-scale-in" />
            Lembur Finder
          </h1>
          <p className="text-muted-foreground text-sm font-medium mt-0.5">
            Perhitungan lembur &amp; on-call fleksibel untuk perawat, shift kerja, hari Minggu, tukar jadwal, dan koreksi absen
          </p>
        </div>
        {selectedPegawai && (
          <Button onClick={exportCSV} className="gap-2 bg-card border border-border hover:bg-accent hover:shadow-elevated rounded-2xl h-11 px-5 font-bold transition-all duration-200 shadow-card">
            <Download className="w-4 h-4 text-muted-foreground" /> Export CSV
          </Button>
        )}
      </div>

      {/* ── Search Panel & Dynamic Rules ── */}
      <Card className="bg-card rounded-2xl border border-border shadow-card hover:shadow-elevated transition-all duration-200 overflow-hidden animate-slide-up">
        <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
            <Search className="w-4 h-4 text-primary" />
            Parameter Pencarian Pegawai
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRulesSettings(!showRulesSettings)}
            className="text-xs font-semibold gap-1.5 rounded-xl border-border h-8 hover:bg-accent hover:text-primary transition-all"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
            <span>{showRulesSettings ? "Sembunyikan Aturan" : "Sesuaikan Aturan & Shift"}</span>
            {showRulesSettings ? <ChevronUp className="w-3.5 h-3.5 ml-0.5" /> : <ChevronDown className="w-3.5 h-3.5 ml-0.5" />}
          </Button>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {/* Main Search Inputs: Nama & Tanggal */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            {/* Nama Pegawai dengan Saran / Autocomplete saat diketik */}
            <div className="sm:col-span-2 space-y-1.5" ref={searchContainerRef}>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Nama Pegawai
                </label>
                {isPrivileged && (
                  <span className="text-[10px] text-muted-foreground/80 italic">
                    Ketik nama untuk saran otomatis
                  </span>
                )}
              </div>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="lf-nama"
                  placeholder={isPrivileged ? "Ketik nama pegawai atau NIK..." : `${user?.nama || ""} (${user?.nik || ""})`}
                  value={isPrivileged ? nama : `${user?.nama || ""} (${user?.nik || ""})`}
                  onChange={e => {
                    if (isPrivileged) {
                      setNama(e.target.value);
                      setShowSuggestions(true);
                    }
                  }}
                  onFocus={() => {
                    if (isPrivileged && suggestions.length > 0) {
                      setShowSuggestions(true);
                    }
                  }}
                  disabled={!isPrivileged}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      setShowSuggestions(false);
                      handleSearch();
                    } else if (e.key === "Escape") {
                      setShowSuggestions(false);
                    }
                  }}
                  className="pl-11 pr-8 h-11 border-border focus:ring-ring bg-background"
                />
                {isPrivileged && nama && (
                  <button
                    type="button"
                    onClick={() => {
                      setNama("");
                      setSuggestions([]);
                      setShowSuggestions(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full"
                    title="Hapus teks"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Dropdown Floating Saran Nama Pegawai */}
                {isPrivileged && showSuggestions && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-card rounded-xl border border-border shadow-float overflow-hidden animate-slide-up max-h-[260px] overflow-y-auto">
                    {fetchingSuggestions ? (
                      <div className="p-3 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                        <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span>Mencari saran nama pegawai...</span>
                      </div>
                    ) : suggestions.length === 0 ? (
                      <div className="p-3 text-center text-xs text-muted-foreground">
                        Tidak ada pegawai yang cocok dengan "{nama}"
                      </div>
                    ) : (
                      <div className="divide-y divide-border/40">
                        {suggestions.map((p) => (
                          <div
                            key={p.id || p.nik}
                            onClick={() => handleSelectSuggestion(p)}
                            className="p-2.5 hover:bg-primary/10 cursor-pointer transition-colors flex items-center justify-between text-left"
                          >
                            <div>
                              <p className="text-xs font-bold text-foreground">{p.nama}</p>
                              <p className="text-[10px] text-muted-foreground">
                                NIK: <span className="font-mono font-semibold">{p.nik}</span> &bull; {p.departemen || p.jbtn || "-"}
                              </p>
                            </div>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-primary/30 text-primary bg-primary/5">
                              Pilih &amp; Cari
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Start Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Dari Tanggal
              </label>
              <div className="relative">
                <CalendarDays className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="lf-start"
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="pl-11 h-11 border-border focus:ring-ring bg-background"
                />
              </div>
            </div>

            {/* End Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Sampai Tanggal
              </label>
              <div className="relative">
                <CalendarDays className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="lf-end"
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="pl-11 h-11 border-border focus:ring-ring bg-background"
                />
              </div>
            </div>
          </div>

          {/* ─── DYNAMIC RULES PANEL ─── */}
          {showRulesSettings && (
            <div className="p-4 bg-muted/40 rounded-2xl border border-border/80 space-y-4 animate-slide-up">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Settings2 className="w-4 h-4 text-primary" />
                  <span>POLA JADWAL SHIFT, HARI LIBUR &amp; ATURAN LEMBUR</span>
                </div>
                <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-primary" />
                  <span>On-call: tanpa batas minimal &bull; Lembur: minimal 1 jam</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. POLA JADWAL KERJA */}
                <div className="p-3.5 bg-card rounded-xl border border-border space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    <span>1. Pola Jadwal Kerja</span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-muted-foreground">Pilih Pola Tugas Pegawai:</label>
                    <Select
                      value={patternType}
                      onValueChange={(val: any) => setPatternType(val)}
                    >
                      <SelectTrigger className="h-9 text-xs border-border bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-border">
                        <SelectItem value="AUTO_PERAWAT">
                          🩺 Shift Perawat (Pagi/Siang/Malam + Minggu)
                        </SelectItem>
                        <SelectItem value="NON_SHIFT">
                          🏢 Non-Shift / Kantor (Senin–Jumat / Sabtu)
                        </SelectItem>
                        <SelectItem value="CUSTOM">
                          ⚙️ Kustom Jam Harian Sendiri
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {patternType === "AUTO_PERAWAT" && (
                    <div className="p-2.5 bg-primary/5 border border-primary/20 rounded-lg text-[11px] text-muted-foreground space-y-1 leading-relaxed">
                      <p className="font-semibold text-primary">Deteksi Otomatis Shift Perawat:</p>
                      <p>&bull; <strong>Pagi:</strong> 07:00 – 14:00 (Masuk pagi)</p>
                      <p>&bull; <strong>Siang:</strong> 14:00 – 21:00 (Masuk siang)</p>
                      <p>&bull; <strong>Malam:</strong> 21:00 – 07:00 (Masuk malam)</p>
                      <p className="text-[10px] text-muted-foreground/80 italic pt-0.5">
                        *Dukungan penuh dinas hari Minggu &amp; integrasi jadwal_dinas SIMRS.
                      </p>
                    </div>
                  )}

                  {patternType === "NON_SHIFT" && (
                    <div className="space-y-2.5 pt-1 border-t border-border/60">
                      {/* Jam Kerja Senin - Jumat */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] font-semibold text-muted-foreground">Masuk (Senin–Jum)</span>
                          <Input type="time" value={workStart} onChange={e => setWorkStart(e.target.value)} className="h-8 text-xs bg-background font-mono" />
                        </div>
                        <div>
                          <span className="text-[10px] font-semibold text-muted-foreground">Pulang (Senin–Jum)</span>
                          <Input type="time" value={workEnd} onChange={e => setWorkEnd(e.target.value)} className="h-8 text-xs bg-background font-mono" />
                        </div>
                      </div>

                      {/* Aturan Hari Sabtu: Opsi Jam Masuk & Pulang, atau Libur */}
                      <div className="pt-2 border-t border-border/40 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-foreground flex items-center gap-1">
                            📅 Jadwal Hari Sabtu:
                          </span>
                          <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-muted-foreground hover:text-foreground">
                            <Checkbox
                              checked={saturdayIsOff}
                              onCheckedChange={checked => setSaturdayIsOff(!!checked)}
                              className="h-3.5 w-3.5"
                            />
                            <span className={saturdayIsOff ? "text-destructive font-bold" : ""}>Sabtu Libur (Off)</span>
                          </label>
                        </div>

                        {saturdayIsOff ? (
                          <div className="p-2 bg-muted/40 rounded-lg text-center text-[10px] text-muted-foreground italic border border-border/40">
                            Hari Sabtu diatur sebagai hari libur kerja
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[10px] text-muted-foreground font-medium">Masuk Sabtu</span>
                              <Input
                                type="time"
                                value={saturdayStart}
                                onChange={e => setSaturdayStart(e.target.value)}
                                className="h-8 text-xs bg-background font-mono"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-muted-foreground font-medium">Pulang Sabtu</span>
                              <Input
                                type="time"
                                value={saturdayEnd}
                                onChange={e => setSaturdayEnd(e.target.value)}
                                className="h-8 text-xs bg-background font-mono"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {patternType === "CUSTOM" && (
                    <div className="space-y-2.5 pt-1 border-t border-border/60">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-foreground">
                          🗓️ Atur Jam Harian (Senin – Minggu):
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCustomDailySchedule({
                              1: { start: "08:00", end: "16:00", isOff: false },
                              2: { start: "08:00", end: "16:00", isOff: false },
                              3: { start: "08:00", end: "16:00", isOff: false },
                              4: { start: "08:00", end: "16:00", isOff: false },
                              5: { start: "08:00", end: "16:00", isOff: false },
                              6: { start: "08:00", end: "13:00", isOff: false },
                              0: { start: "07:00", end: "14:00", isOff: true  },
                            });
                            toast({ title: "Reset", description: "Jadwal harian direset ke standar jam kantor." });
                          }}
                          className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                        >
                          Reset Default
                        </Button>
                      </div>

                      <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                        {[
                          { id: 1, name: "Senin" },
                          { id: 2, name: "Selasa" },
                          { id: 3, name: "Rabu" },
                          { id: 4, name: "Kamis" },
                          { id: 5, name: "Jumat" },
                          { id: 6, name: "Sabtu" },
                          { id: 0, name: "Minggu" }
                        ].map(day => {
                          const sched = customDailySchedule[day.id] || { start: "08:00", end: "16:00", isOff: false };
                          return (
                            <div
                              key={day.id}
                              className={`p-1.5 px-2 rounded-xl border text-xs flex items-center justify-between gap-1.5 transition-all ${
                                sched.isOff
                                  ? "bg-destructive/5 border-destructive/20 text-muted-foreground"
                                  : "bg-background border-border"
                              }`}
                            >
                              <div className="w-14 shrink-0">
                                <span className={`font-bold text-[11px] ${sched.isOff ? "text-destructive line-through opacity-70" : "text-foreground"}`}>
                                  {day.name}
                                </span>
                              </div>

                              {sched.isOff ? (
                                <div className="flex-1 text-center font-bold text-[10px] text-destructive">
                                  LIBUR (OFF)
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 flex-1">
                                  <div className="flex-1">
                                    <Input
                                      type="time"
                                      value={sched.start}
                                      onChange={e => {
                                        setCustomDailySchedule(prev => ({
                                          ...prev,
                                          [day.id]: { ...sched, start: e.target.value }
                                        }));
                                      }}
                                      className="h-7 text-[11px] font-mono px-1 bg-muted/20"
                                    />
                                  </div>
                                  <span className="text-muted-foreground text-[10px]">&ndash;</span>
                                  <div className="flex-1">
                                    <Input
                                      type="time"
                                      value={sched.end}
                                      onChange={e => {
                                        setCustomDailySchedule(prev => ({
                                          ...prev,
                                          [day.id]: { ...sched, end: e.target.value }
                                        }));
                                      }}
                                      className="h-7 text-[11px] font-mono px-1 bg-muted/20"
                                    />
                                  </div>
                                </div>
                              )}

                              <label className="flex items-center gap-1 cursor-pointer shrink-0 pl-1">
                                <Checkbox
                                  checked={sched.isOff}
                                  onCheckedChange={checked => {
                                    setCustomDailySchedule(prev => ({
                                      ...prev,
                                      [day.id]: { ...sched, isOff: !!checked }
                                    }));
                                  }}
                                  className="h-3.5 w-3.5"
                                />
                                <span className="text-[10px] text-muted-foreground">Off</span>
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. HARI LIBUR & TANGGAL MERAH */}
                <div className="p-3.5 bg-card rounded-xl border border-border space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    <span>2. Hari Libur &amp; Tanggal Merah</span>
                  </div>

                  {patternType !== "AUTO_PERAWAT" && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-muted-foreground">Hari Libur Mingguan:</label>
                      <div className="flex flex-wrap gap-1.5">
                        {DAYS_OF_WEEK.map(day => {
                          const isChecked = holidayDays.includes(day.id) || (day.id === 6 && saturdayIsOff);
                          return (
                            <button
                              type="button"
                              key={day.id}
                              onClick={() => toggleHolidayDay(day.id)}
                              className={`px-2 py-1 rounded-lg text-xs font-semibold border transition-all ${
                                isChecked 
                                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                  : "bg-background text-muted-foreground border-border hover:border-primary/40"
                              }`}
                            >
                              {day.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Tanggal Merah Tambahan */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-muted-foreground">Tambah Tanggal Merah / Cuti Bersama:</label>
                    <div className="flex gap-1.5">
                      <Input
                        type="date"
                        value={newHolidayInput}
                        onChange={e => setNewHolidayInput(e.target.value)}
                        className="h-9 text-xs bg-background flex-1"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={addCustomHoliday}
                        className="h-9 px-3 rounded-lg text-xs font-bold gap-1 shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" /> Tambah
                      </Button>
                    </div>

                    {customHolidays.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1 max-h-20 overflow-y-auto">
                        {customHolidays.map(tgl => (
                          <Badge
                            key={tgl}
                            variant="secondary"
                            className="text-[10px] font-semibold pl-2 pr-1 py-0.5 gap-1 rounded-md bg-destructive/10 text-destructive border border-destructive/20"
                          >
                            <span>{tgl}</span>
                            <button
                              type="button"
                              onClick={() => removeCustomHoliday(tgl)}
                              className="hover:bg-destructive/20 p-0.5 rounded"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {(Object.keys(scheduleOverrides).length > 0 || Object.keys(manualCorrections).length > 0) && (
                    <div className="p-2 bg-warning/10 border border-warning/20 rounded-lg text-[11px] text-warning flex items-center justify-between">
                      <span>{Object.keys(scheduleOverrides).length} tukar jadwal &bull; {Object.keys(manualCorrections).length} koreksi absen</span>
                      <button
                        type="button"
                        onClick={() => { setScheduleOverrides({}); setManualCorrections({}); executeSearch({}, {}); }}
                        className="text-[10px] font-bold underline hover:opacity-80"
                      >
                        Reset Semua
                      </button>
                    </div>
                  )}
                </div>

                {/* 3. ATURAN ON-CALL & LEMBUR */}
                <div className="p-3.5 bg-card rounded-xl border border-border space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <PhoneCall className="w-3.5 h-3.5 text-primary" />
                    <span>3. Aturan On-Call &amp; Lembur</span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-muted-foreground">
                      Absen di Luar Shift / Hari Libur Dihitung:
                    </label>
                    <Select
                      value={outsideShiftMode}
                      onValueChange={(val: "ON-CALL" | "LEMBUR") => setOutsideShiftMode(val)}
                    >
                      <SelectTrigger className="h-9 text-xs border-border bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-border">
                        <SelectItem value="ON-CALL">
                          <div className="flex items-center gap-2">
                            <PhoneCall className="w-3.5 h-3.5 text-info" />
                            <span>Sebagai ON-CALL (Tanpa Batas Minimal)</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="LEMBUR">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-3.5 h-3.5 text-warning" />
                            <span>Sebagai LEMBUR (Minimal 1 Jam)</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="p-2.5 bg-muted/60 rounded-lg text-[11px] text-muted-foreground space-y-1 leading-normal border border-border/50">
                    <p className="font-bold text-foreground">Ketentuan Sesuai Aturan RS:</p>
                    <p>&bull; <strong>On-Call:</strong> Tanpa batas minimal jam (durasi riil berapapun menitnya dihitung penuh).</p>
                    <p>&bull; <strong>Lembur:</strong> Wajib kelebihan minimal <strong>1 jam (60 menit)</strong> setelah jam shift selesai baru dihitung.</p>
                  </div>
                </div>
              </div>

              {/* Status Ringkasan Rules Aktif */}
              <div className="p-2.5 bg-background/80 rounded-xl border border-border/60 flex flex-wrap items-center justify-between text-xs text-muted-foreground gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                  <span>
                    <strong>Pola Aktif:</strong> {patternType === 'AUTO_PERAWAT' ? 'Perawat / Pelayanan (Auto-Shift Pagi/Siang/Malam)' : patternType === 'NON_SHIFT' ? 'Non-Shift (Kantor)' : 'Kustom Harian'} &middot; Luar Shift: <strong>{outsideShiftMode}</strong> {Object.keys(scheduleOverrides).length > 0 ? `&middot; (${Object.keys(scheduleOverrides).length} Tukar Jadwal)` : ''} {Object.keys(manualCorrections).length > 0 ? `&middot; (${Object.keys(manualCorrections).length} Koreksi Manual)` : ''}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Submit Search Button */}
          <div className="flex justify-end pt-2">
            <Button
              id="lf-search-btn"
              onClick={handleSearch}
              disabled={loading}
              className="gap-2 bg-primary text-primary-foreground hover:opacity-90 transition-all rounded-2xl font-bold shadow-card h-11 px-7 min-w-[150px]"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              {loading ? "Menghitung..." : "Cari Lembur"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Multiple results: pilih pegawai ── */}
      {results.length > 1 && (
        <Card className="bg-card rounded-2xl border border-border shadow-card hover:shadow-elevated transition-all duration-200 overflow-hidden animate-slide-up">
          <CardHeader className="pb-2 border-b border-border">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Ditemukan {results.length} pegawai — pilih salah satu:
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="flex flex-wrap gap-2">
              {results.map(r => (
                <Button
                  key={r.pin}
                  variant={selectedPin === r.pin ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedPin(r.pin)}
                  className="gap-1.5 rounded-xl h-9 text-xs"
                >
                  <User className="w-3.5 h-3.5" />
                  {r.nama}
                  <span className="text-[10px] opacity-75">({r.departemen})</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Summary Cards ── */}
      {selectedPegawai && summary && (
        <>
          {/* Info pegawai */}
          <div className="flex items-center gap-3 px-1 animate-slide-up">
            <div className="w-10 h-10 rounded-2xl bg-gradient-primary flex items-center justify-center text-white font-bold text-sm shadow-card">
              {selectedPegawai.nama.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-base leading-tight text-foreground">{selectedPegawai.nama}</p>
              <p className="text-xs text-muted-foreground font-semibold">{selectedPegawai.departemen} &bull; NIK: {selectedPegawai.pin}</p>
            </div>
            <div className="ml-auto text-xs text-muted-foreground font-medium">
              Periode: <strong>{startDate}</strong> s/d <strong>{endDate}</strong>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up">
            <Card className="border-warning/20 bg-warning/5 shadow-card hover:shadow-elevated transition-all duration-200">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-warning" />
                  <span className="text-[10px] font-bold text-warning uppercase tracking-wider">Total Lembur</span>
                </div>
                <p className="text-2xl font-bold text-warning">{formatDurasi(summary.totalLemburMenit)}</p>
                <p className="text-[11px] font-medium text-warning/80">{summary.hariLembur} hari lembur (&ge; 1 jam)</p>
              </CardContent>
            </Card>

            <Card className="border-info/20 bg-info/5 shadow-card hover:shadow-elevated transition-all duration-200">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <PhoneCall className="w-4 h-4 text-info" />
                  <span className="text-[10px] font-bold text-info uppercase tracking-wider">Total On-Call</span>
                </div>
                <p className="text-2xl font-bold text-info">{formatDurasi(summary.totalOnCallMenit)}</p>
                <p className="text-[11px] font-medium text-info/80">{summary.hariOnCall} hari on-call (tanpa min)</p>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/5 shadow-card hover:shadow-elevated transition-all duration-200">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Jam Lembur (Rata²)</span>
                </div>
                <p className="text-2xl font-bold text-primary">
                  {summary.hariLembur > 0
                    ? formatDurasi(Math.round(summary.totalLemburMenit / summary.hariLembur))
                    : "–"}
                </p>
                <p className="text-[11px] font-medium text-primary/80">per hari lembur</p>
              </CardContent>
            </Card>

            <Card className="border-border bg-muted/30 shadow-card hover:shadow-elevated transition-all duration-200">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <CalendarDays className="w-4 h-4 text-muted-foreground" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Kejadian</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {summary.hariLembur + summary.hariOnCall}
                </p>
                <p className="text-[11px] font-medium text-muted-foreground">lembur + on-call</p>
              </CardContent>
            </Card>
          </div>

          {/* ── Detail Table ── */}
          <Card className="bg-card rounded-2xl border border-border shadow-card hover:shadow-elevated transition-all duration-200 overflow-hidden animate-slide-up">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-bold text-foreground">Detail Harian — Lembur &amp; On-Call</CardTitle>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Gunakan tombol <strong className="text-primary">Tukar ▾</strong> untuk ganti shift, atau tombol <strong className="text-warning">Koreksi</strong> jika salah tekan tombol fingerprint.
                  </p>
                </div>
                <div className="flex gap-3 text-[10px] font-bold uppercase tracking-wider shrink-0">
                  <span className="flex items-center gap-1.5 text-warning">
                    <span className="w-2 h-2 rounded-full bg-warning inline-block" /> Lembur (&ge;1j)
                  </span>
                  <span className="flex items-center gap-1.5 text-info">
                    <span className="w-2 h-2 rounded-full bg-info inline-block" /> On-Call
                  </span>
                  <span className="flex items-center gap-1.5 text-success">
                    <span className="w-2 h-2 rounded-full bg-success inline-block" /> Normal
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30 border-b border-border">
                    <TableRow>
                      <TableHead className="w-[105px] font-bold text-xs text-muted-foreground">Tanggal</TableHead>
                      <TableHead className="w-[85px] font-bold text-xs text-muted-foreground">Hari</TableHead>
                      <TableHead className="min-w-[190px] font-bold text-xs text-muted-foreground">Jadwal Shift / Tukar</TableHead>
                      <TableHead className="text-center font-bold text-xs text-muted-foreground">Masuk</TableHead>
                      <TableHead className="text-center font-bold text-xs text-muted-foreground">Pulang</TableHead>
                      <TableHead className="text-center font-bold text-xs text-muted-foreground">Tipe</TableHead>
                      <TableHead className="text-center font-bold text-xs text-muted-foreground">Durasi</TableHead>
                      <TableHead className="font-bold text-xs text-muted-foreground">Keterangan</TableHead>
                      <TableHead className="text-center w-[100px] font-bold text-xs text-muted-foreground">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPegawai.daily.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12 text-muted-foreground text-sm">
                          Tidak ada data absensi ditemukan dalam periode ini.
                        </TableCell>
                      </TableRow>
                    ) : (
                      selectedPegawai.daily.map((d, idx) => {
                        const hasOverride = !!scheduleOverrides[d.tanggal];
                        const hasCorrection = !!manualCorrections[d.tanggal] || d.is_koreksi;

                        return (
                          <TableRow
                            key={`${d.tanggal}-${idx}`}
                            className={`border-b border-border/40 transition-colors ${
                              hasCorrection
                                ? "bg-primary/5 hover:bg-primary/10"
                                : d.tipe === "LEMBUR"
                                ? "bg-warning/5 hover:bg-warning/10"
                                : d.tipe === "ON-CALL"
                                ? "bg-info/5 hover:bg-info/10"
                                : d.tipe === "TIDAK_LENGKAP"
                                ? "bg-destructive/5 hover:bg-destructive/10"
                                : "hover:bg-muted/10"
                            }`}
                          >
                            <TableCell className="font-mono text-xs font-semibold text-foreground">{d.tanggal}</TableCell>
                            <TableCell>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  d.hari === "Minggu"
                                    ? "bg-destructive/10 text-destructive border-destructive/20"
                                    : d.hari === "Sabtu"
                                    ? "bg-primary/10 text-primary border-primary/20"
                                    : "bg-muted text-muted-foreground border-border"
                                }`}
                              >
                                {d.hari}
                              </span>
                            </TableCell>

                            {/* Kolom Jadwal Shift & Tukar Jadwal */}
                            <TableCell>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-xs font-medium ${hasOverride ? "text-primary font-bold" : "text-muted-foreground"}`}>
                                  {d.shift_label}
                                </span>

                                {/* Dropdown Tukar Jadwal Hari */}
                                <Select onValueChange={(val) => handleSwapShift(d.tanggal, val)}>
                                  <SelectTrigger className={`h-6 px-1.5 py-0 text-[10px] rounded-md border gap-1 w-auto shrink-0 ${
                                    hasOverride ? "bg-primary/10 border-primary/30 text-primary font-bold" : "bg-muted/50 border-border text-muted-foreground hover:text-foreground"
                                  }`}>
                                    <Repeat className="w-2.5 h-2.5" />
                                    <span>Tukar ▾</span>
                                  </SelectTrigger>
                                  <SelectContent className="border-border">
                                    <SelectItem value="PAGI">
                                      <div className="flex items-center gap-1.5 text-xs">
                                        <Sun className="w-3.5 h-3.5 text-warning" />
                                        <span>Tukar: Shift Pagi (07:00–14:00)</span>
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="SIANG">
                                      <div className="flex items-center gap-1.5 text-xs">
                                        <Sunset className="w-3.5 h-3.5 text-primary" />
                                        <span>Tukar: Shift Siang (14:00–21:00)</span>
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="MALAM">
                                      <div className="flex items-center gap-1.5 text-xs">
                                        <Moon className="w-3.5 h-3.5 text-info" />
                                        <span>Tukar: Shift Malam (21:00–07:00)</span>
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="KANTOR">
                                      <div className="flex items-center gap-1.5 text-xs">
                                        <Clock className="w-3.5 h-3.5 text-foreground" />
                                        <span>Tukar: Kantor (08:00–16:00)</span>
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="OFF">
                                      <div className="flex items-center gap-1.5 text-xs">
                                        <Coffee className="w-3.5 h-3.5 text-destructive" />
                                        <span>Tukar: Hari Libur (Off)</span>
                                      </div>
                                    </SelectItem>
                                    {hasOverride && (
                                      <SelectItem value="RESET">
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                          <RotateCcw className="w-3.5 h-3.5" />
                                          <span>Kembalikan ke Jadwal Awal</span>
                                        </div>
                                      </SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                            </TableCell>

                            <TableCell className="text-center">
                              {d.jam_masuk ? (
                                <span className="font-bold text-primary text-xs font-mono">{d.jam_masuk}</span>
                              ) : (
                                <span className="text-xs text-muted-foreground/60 italic">–</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {d.jam_pulang ? (
                                <span
                                  className={`font-bold text-xs font-mono ${
                                    d.tipe === "LEMBUR" ? "text-warning" : "text-foreground"
                                  }`}
                                >
                                  {d.jam_pulang}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground/60 italic">–</span>
                              )}
                            </TableCell>

                            <TableCell className="text-center">
                              <div className="flex flex-col items-center gap-1">
                                {tipeBadge(d.tipe)}
                                {hasCorrection && (
                                  <span className="text-[9px] font-bold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.2 rounded">
                                    DIKOREKSI
                                  </span>
                                )}
                              </div>
                            </TableCell>

                            <TableCell className="text-center">
                              {d.durasi_menit > 0 ? (
                                <span
                                  className={`font-bold text-xs ${
                                    d.tipe === "LEMBUR"
                                      ? "text-warning"
                                      : d.tipe === "ON-CALL"
                                      ? "text-info"
                                      : "text-foreground"
                                  }`}
                                >
                                  {formatDurasi(d.durasi_menit)}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground/60">–</span>
                              )}
                            </TableCell>

                            <TableCell className="text-xs text-muted-foreground max-w-[240px] font-medium">
                              {d.detail || "–"}
                            </TableCell>

                            {/* Kolom Tombol Koreksi Absen */}
                            <TableCell className="text-center">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openCorrectionDialog(d)}
                                className={`h-7 px-2.5 text-[10px] font-bold gap-1 rounded-lg border transition-all ${
                                  d.tipe === "TIDAK_LENGKAP"
                                    ? "bg-warning/15 border-warning/40 text-warning hover:bg-warning hover:text-warning-foreground shadow-sm animate-pulse"
                                    : hasCorrection
                                    ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
                                    : "bg-background border-border text-muted-foreground hover:text-foreground"
                                }`}
                                title="Koreksi kesalahan input mesin fingerprint"
                              >
                                <Wrench className="w-3 h-3" />
                                <span>{hasCorrection ? "Edit Koreksi" : "Koreksi"}</span>
                              </Button>
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

          {/* Footer */}
          <p className="text-xs text-muted-foreground text-center pb-2 font-medium">
            Hanya menampilkan hari dengan data absensi &bull; Total baris: {selectedPegawai.daily.length}
          </p>
        </>
      )}

      {/* Empty state setelah search */}
      {hasSearched && !loading && results.length === 0 && (
        <Card className="bg-card rounded-2xl border border-border shadow-card hover:shadow-elevated transition-all p-12">
          <CardContent className="py-12 text-center flex flex-col items-center">
            <Search className="w-10 h-10 text-muted-foreground mb-3 opacity-40 animate-pulse" />
            <p className="text-foreground font-semibold">Tidak ada data ditemukan</p>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              Coba periksa ejaan nama atau perluas rentang tanggal
            </p>
          </CardContent>
        </Card>
      )}

      {/* ─── MODAL DIALOG KOREKSI ABSENSI FINGERPRINT ─── */}
      <Dialog open={koreksiOpen} onOpenChange={setKoreksiOpen}>
        <DialogContent className="sm:max-w-[460px] rounded-2xl border border-border bg-card p-6 shadow-float">
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Wrench className="w-5 h-5 text-warning" />
              <span>Koreksi Absensi &amp; Fingerprint</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Perbaiki kesalahan tombol pada mesin fingerprint atau lengkapi jam masuk/pulang untuk tanggal <strong>{koreksiDate}</strong> ({koreksiHari}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Quick Suggestion: Gabungkan tap jika ada tap pagi & dini hari (seperti 07:14 dan 01:03) */}
            {detectedPairSuggestions && (
              <div className="p-3 bg-warning/10 border border-warning/25 rounded-xl text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-warning">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Saran Penggabungan Otomatis:</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-normal">
                  Ditemukan scan masuk jam <strong>{detectedPairSuggestions.masuk}</strong> dan scan pulang dini hari jam <strong>{detectedPairSuggestions.pulang}</strong>.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setKoreksiMasuk(detectedPairSuggestions.masuk);
                    setKoreksiPulang(detectedPairSuggestions.pulang);
                    setKoreksiTipe("LEMBUR");
                    setKoreksiDetail("Koreksi penggabungan: Masuk " + detectedPairSuggestions.masuk + " & Pulang dini hari " + detectedPairSuggestions.pulang);
                  }}
                  className="w-full text-xs font-bold h-8 gap-1.5 bg-background border-warning/30 text-warning hover:bg-warning hover:text-warning-foreground"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Gunakan Masuk {detectedPairSuggestions.masuk} &amp; Pulang {detectedPairSuggestions.pulang} (Lembur)</span>
                </Button>
              </div>
            )}

            {/* Input Jam Masuk & Pulang */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Jam Masuk</label>
                <Input
                  type="time"
                  value={koreksiMasuk}
                  onChange={e => setKoreksiMasuk(e.target.value)}
                  className="h-10 text-sm font-mono bg-background border-border"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Jam Pulang</label>
                <Input
                  type="time"
                  value={koreksiPulang}
                  onChange={e => setKoreksiPulang(e.target.value)}
                  className="h-10 text-sm font-mono bg-background border-border"
                />
              </div>
            </div>

            {/* Pilihan Tipe Hasil */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Status Perhitungan</label>
              <Select value={koreksiTipe} onValueChange={(val: "LEMBUR" | "ON-CALL") => setKoreksiTipe(val)}>
                <SelectTrigger className="h-10 border-border bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border">
                  <SelectItem value="LEMBUR">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-3.5 h-3.5 text-warning" />
                      <span>Hitung sebagai LEMBUR (&ge; 1 jam setelah shift selesai)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="ON-CALL">
                    <div className="flex items-center gap-2">
                      <PhoneCall className="w-3.5 h-3.5 text-info" />
                      <span>Hitung sebagai ON-CALL (Tanpa batas minimal)</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Keterangan Koreksi */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Alasan / Keterangan Koreksi</label>
              <Input
                placeholder="Contoh: Salah pilih status input pada mesin fingerprint"
                value={koreksiDetail}
                onChange={e => setKoreksiDetail(e.target.value)}
                className="h-10 text-xs bg-background border-border"
              />
            </div>
          </div>

          <DialogFooter className="flex flex-row items-center justify-between sm:justify-between pt-4 border-t border-border mt-2">
            {manualCorrections[koreksiDate] ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetCorrection}
                className="text-xs text-destructive hover:bg-destructive/10 h-9 px-3"
              >
                Hapus Koreksi
              </Button>
            ) : <div />}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setKoreksiOpen(false)}
                className="text-xs h-9 px-4 rounded-xl"
              >
                Batal
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveCorrection}
                className="text-xs font-bold h-9 px-5 rounded-xl bg-primary text-primary-foreground gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Simpan Koreksi</span>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
