import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, RefreshCw, Calendar as CalendarIcon, User, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { DEPARTEMEN_LIST } from "@/data/mockData";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, subMonths, setDate, isSunday } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ShiftCount {
  P: number; S: number; M: number; Md: number; Lm: number; L: number; Oc: number; PS: number; X: number;
  SID: number; SKS: number; Pe: number; Ct: number; CB: number; i: number; A: number;
}

const SHIFT_OPTIONS = ['P', 'S', 'M', 'PS', 'X', 'Md', 'L', 'Lm', 'Oc', 'SID', 'SKS', 'Pe', 'Ct', 'CB', 'i', 'A'];

interface ReportItem {
  pin: string;
  nama: string;
  pendidikan: string;
  jbtn: string;
  mulai_kerja: string;
  jam_wajib: number;
  jam_aktual: number;
  jam_lembur: number;
  count_lembur: number;
  hutang_jam: number;
  sisa_cuti: number;
  shift_counts: ShiftCount;
  daily_status: Record<string, { wajib: string; lembur: string }>;
  benchmark_karu: number;
}

export default function LaporanDepartemen() {
  const { toast } = useToast();
  const [data, setData] = useState<ReportItem[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [dept, setDept] = useState("KB");
  const [hiddenDates, setHiddenDates] = useState<string[]>([]);

  // Periode default: 21 bulan lalu s/d 25 bulan ini
  const [startDate, setStartDate] = useState<Date>(setDate(subMonths(new Date(), 1), 21));
  const [endDate, setEndDate] = useState<Date>(setDate(new Date(), 25));

  const periodRange = useMemo(() => ({
    start: format(startDate, "yyyy-MM-dd"),
    end: format(endDate, "yyyy-MM-dd")
  }), [startDate, endDate]);

  const fetchReport = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch(`http://localhost:3103/api/absensi/laporan-kb?startDate=${periodRange.start}&endDate=${periodRange.end}&departemen=${dept}`);
      const result = await res.json();
      if (result.success) {
        setData(result.data);
        setDates(result.dates);
      } else {
        toast({ title: "Gagal", description: result.message, variant: "destructive" });
      }
    } catch (error) {
      console.error("Error fetching report:", error);
      toast({ title: "Gagal", description: "Terjadi kesalahan saat mengambil laporan.", variant: "destructive" });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [periodRange, dept, toast]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleUpdateShift = async (
    pin: string, 
    tanggal: string, 
    shift: string, 
    kategori: 'WAJIB' | 'LEMBUR' = 'WAJIB',
    jam_mulai?: string,
    jam_selesai?: string
  ) => {
    try {
      const res = await fetch(`http://localhost:3103/api/absensi/jadwal-dinas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, tanggal, shift, kategori, jam_mulai, jam_selesai })
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: "Berhasil", description: `Jadwal ${pin} tgl ${tanggal} (${kategori}) diperbarui` });
        fetchReport(true); 
      } else {
        toast({ title: "Gagal", description: result.message, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Gagal", description: "Terjadi kesalahan saat menyimpan jadwal.", variant: "destructive" });
    }
  };

  const exportCSV = () => {
    if (data.length === 0) return;

    const headers = [
      "NIK", "Nama", "Pendidikan", "Jabatan", "Mulai Kerja", "Wajib Masuk",
      ...dates.map(d => format(new Date(d), "dd/MM")),
      "P", "S", "M", "Md", "L", "Cuti/Ijin", "Aktual", "Lembur", "Hutang", "Sisa Cuti"
    ].join(",");

    const rows = data.map(item => {
      const daily = dates.map(d => item.daily_status[d]?.wajib || "-").join(",");
      const s = item.shift_counts;
      const cutiIjin = s.SID + s.SKS + s.Pe + s.Ct + s.i;
      return [
        item.pin, item.nama, item.pendidikan, item.jbtn, item.mulai_kerja, item.jam_wajib,
        daily,
        s.P, s.S, s.M, s.Md, s.L + s.Lm, cutiIjin,
        item.jam_aktual, item.jam_lembur, item.hutang_jam, item.sisa_cuti
      ].join(",");
    }).join("\n");

    const blob = new Blob([headers + "\n" + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `laporan_${dept}_${periodRange.start}_${periodRange.end}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const columnTotals = useMemo(() => {
    const totals: Record<string, { P: number; S: number; M: number }> = {};
    dates.forEach(d => {
      totals[d] = { P: 0, S: 0, M: 0 };
      data.forEach(item => {
        const shift = item.daily_status[d]?.wajib;
        if (shift === 'P') totals[d].P++;
        if (shift === 'S') totals[d].S++;
        if (shift === 'M') totals[d].M++;
        if (shift === 'PS') { totals[d].P++; totals[d].S++; }
      });
    });
    return totals;
  }, [data, dates]);

  const toggleHideDate = (date: string) => {
    setHiddenDates(prev => prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]);
  };

  const resetHiddenDates = () => setHiddenDates([]);

  const filteredDates = dates.filter(d => !hiddenDates.includes(d));

  const getShiftColor = (shift: string) => {
    switch (shift) {
      case 'P': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'S': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'PS': return 'bg-indigo-100 text-indigo-700 border-indigo-200 font-bold';
      case 'X': return 'bg-slate-900 text-white border-slate-900 font-bold';
      case 'M': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'Md': return 'bg-cyan-100 text-cyan-700 border-cyan-200';
      case 'L':
      case 'Lm': return 'bg-slate-100 text-slate-500 border-slate-200';
      case 'Ct':
      case 'CB': return 'bg-green-100 text-green-700 border-green-200';
      case 'i': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'A': return 'bg-red-100 text-red-700 border-red-200 font-bold';
      case 'Oc': return 'bg-yellow-100 text-yellow-700 border-yellow-200 font-bold';
      case 'SID': return 'bg-pink-100 text-pink-700 border-pink-200';
      case 'SKS': return 'bg-teal-100 text-teal-700 border-teal-200';
      case 'Pe': return 'bg-violet-100 text-violet-700 border-violet-200';
      default: return 'bg-slate-50 text-slate-400 border-slate-100';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Laporan Absen Per Departemen
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">{dept}</Badge>
          </h1>
          <p className="text-muted-foreground text-sm">
            Periode: <span className="font-semibold text-foreground">{format(startDate, "dd MMMM yyyy", { locale: idLocale })}</span> - <span className="font-semibold text-foreground">{format(endDate, "dd MMMM yyyy", { locale: idLocale })}</span>
          </p>
        </div>
        <div className="flex gap-2">
          {hiddenDates.length > 0 && (
            <Button variant="outline" size="sm" onClick={resetHiddenDates} className="h-10 text-xs border-dashed text-orange-600 border-orange-200 hover:bg-orange-50">
              Reset Kolom ({hiddenDates.length} Sembunyi)
            </Button>
          )}
          <Button variant="outline" onClick={() => fetchReport()} className="gap-2 bg-white">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Sinkron Data
          </Button>
          <Button onClick={exportCSV} className="gap-2 shadow-md">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-xl bg-slate-50/50">
        <CardHeader className="pb-4 bg-white rounded-t-xl border-b">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="space-y-1.5 flex-1 min-w-[180px]">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5" /> Tanggal Mulai
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full h-10 justify-start text-left font-normal bg-white border-slate-200", !startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                    {startDate ? format(startDate, "dd MMM yyyy", { locale: idLocale }) : <span>Pilih tanggal</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={(d) => d && setStartDate(d)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5 flex-1 min-w-[180px]">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5" /> Tanggal Selesai
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full h-10 justify-start text-left font-normal bg-white border-slate-200", !endDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                    {endDate ? format(endDate, "dd MMM yyyy", { locale: idLocale }) : <span>Pilih tanggal</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={(d) => d && setEndDate(d)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                Departemen
              </label>
              <Select value={dept} onValueChange={setDept}>
                <SelectTrigger className="h-10 bg-white border-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Departemen</SelectItem>
                  {DEPARTEMEN_LIST.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-4 p-3 bg-slate-100/50 rounded-lg border border-slate-200/60 mb-0.5">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Standard Karu</span>
                <span className="text-sm font-bold text-primary">{data[0]?.jam_aktual || 0} Jam</span>
              </div>
              <div className="w-px h-8 bg-slate-300"></div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Total SDM</span>
                <span className="text-sm font-bold text-slate-700">{data.length} Orang</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300">
            <h3 className="text-sm font-bold p-4 bg-blue-50/30 text-blue-800 border-b">Tabel Kehadiran & Jam Kerja</h3>
            <Table className="border-collapse">
              <TableHeader className="bg-slate-100/80 sticky top-0 z-10">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[50px] border-r font-bold text-slate-700">No</TableHead>
                  <TableHead className="min-w-[180px] border-r font-bold text-slate-700 sticky left-0 bg-slate-100/80 z-20">Nama & Jabatan</TableHead>
                  <TableHead className="min-w-[100px] border-r text-center font-bold text-slate-700">Pendidikan</TableHead>
                  <TableHead className="min-w-[110px] border-r text-center font-bold text-slate-700">Mulai Kerja</TableHead>
                  <TableHead className="min-w-[100px] border-r text-center font-bold text-blue-700 bg-blue-50/50 font-black">Wajib / Lembur</TableHead>

                  {filteredDates.map(date => (
                    <TableHead key={date} className={`min-w-[45px] text-center border-r font-bold text-[11px] ${isSunday(new Date(date)) ? 'bg-red-50 text-red-600' : 'text-slate-600'}`}>
                      {format(new Date(date), "dd")}<br />
                      <span className="text-[9px] font-normal opacity-70 uppercase">{format(new Date(date), "EEE", { locale: idLocale })}</span>
                    </TableHead>
                  ))}

                  <TableHead className="min-w-[150px] border-r text-center font-bold text-slate-700 bg-slate-200/50">Total Shift</TableHead>
                  <TableHead className="min-w-[80px] border-r text-center font-bold text-indigo-700 bg-indigo-50/50">Total Jam</TableHead>
                  <TableHead className="min-w-[80px] border-r text-center font-bold text-green-700 bg-green-50/50">Lembur</TableHead>
                  <TableHead className="min-w-[80px] border-r text-center font-bold text-red-700 bg-red-50/50">Hutang Jam</TableHead>
                  <TableHead className="min-w-[80px] text-center font-bold text-orange-700 bg-orange-50/50">Sisa Cuti</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-white">
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={dates.length + 10} className="h-40 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                        <p className="text-xs font-medium text-slate-500">Memuat data...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={dates.length + 10} className="h-40 text-center text-slate-400">
                      Belum ada data untuk periode ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {data.map((item, idx) => (
                      <Fragment key={item.pin}>
                        {/* BARIS UTAMA (WAJIB) */}
                        <TableRow className="hover:bg-slate-50 transition-colors border-b-0">
                          <TableCell className="text-center font-medium border-r text-slate-500" rowSpan={2}>{idx + 1}</TableCell>
                          <TableCell className="border-r font-medium sticky left-0 bg-white z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" rowSpan={2}>
                            <div className="flex flex-col">
                              <span>{item.nama}</span>
                              <span className="text-[10px] text-slate-400 font-normal">{item.jbtn}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center border-r text-[11px]" rowSpan={2}>{item.pendidikan}</TableCell>
                          <TableCell className="text-center border-r text-[11px]" rowSpan={2}>{item.mulai_kerja}</TableCell>
                          <TableCell className="text-center border-r font-bold bg-blue-50/20 p-1 text-[10px] text-blue-700">KERJA</TableCell>

                          {filteredDates.map(date => {
                            const shift = item.daily_status[date]?.wajib;
                            return (
                              <TableCell key={date} className={`p-1 border-r text-center cursor-pointer hover:bg-slate-100 transition-colors ${isSunday(new Date(date)) ? 'bg-red-50/30' : ''}`}>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <div className="w-full h-full min-h-[30px] flex items-center justify-center" title="Edit Shift Wajib">
                                      {shift && shift !== '-' ? (
                                        <div className={`text-[10px] font-bold h-7 w-7 flex items-center justify-center rounded border mx-auto ${getShiftColor(shift)} shadow-sm`}>
                                          {shift}
                                        </div>
                                      ) : (
                                        <span className="text-slate-200">/</span>
                                      )}
                                    </div>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-48 p-2" align="center">
                                    <div className="text-[10px] font-bold mb-2 text-slate-500 uppercase px-1">Shift Wajib:</div>
                                    <div className="grid grid-cols-3 gap-1">
                                      {SHIFT_OPTIONS.map(opt => (
                                        <Button
                                          key={opt}
                                          variant={shift === opt ? "default" : "outline"}
                                          className="h-8 text-[10px] p-0"
                                          onClick={() => handleUpdateShift(item.pin, date, opt, 'WAJIB')}
                                        >
                                          {opt}
                                        </Button>
                                      ))}
                                      <Button
                                        variant="ghost"
                                        className="h-8 text-[10px] p-0 col-span-3 border-t mt-1 text-red-500"
                                        onClick={() => handleUpdateShift(item.pin, date, '-', 'WAJIB')}
                                      >
                                        Hapus
                                      </Button>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </TableCell>
                            );
                          })}

                          <TableCell className="border-r bg-slate-50/50 p-2" rowSpan={2}>
                            <div className="flex flex-col gap-1.5">
                              <div className="grid grid-cols-4 gap-1 text-[9px] font-bold text-center">
                                <div className="bg-white border rounded py-0.5" title="Pagi">P:{item.shift_counts.P}</div>
                                <div className="bg-white border rounded py-0.5" title="Sore">S:{item.shift_counts.S}</div>
                                <div className="bg-white border rounded py-0.5" title="Malam">M:{item.shift_counts.M}</div>
                                <div className="bg-white border rounded py-0.5" title="Cuti/Ijin">C:{item.shift_counts.Ct + item.shift_counts.CB + item.shift_counts.i + item.shift_counts.SID}</div>
                              </div>
                              <div className="bg-green-50 text-green-700 border border-green-200 rounded py-1 px-1 text-[9px] font-bold text-center">
                                Lembur {item.count_lembur} hari ({item.jam_lembur} jam)
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="text-center border-r font-bold text-indigo-700 bg-indigo-50/20" rowSpan={2}>{item.jam_aktual}</TableCell>
                          <TableCell className="text-center border-r font-bold text-green-700 bg-green-50/20" rowSpan={2}>
                            {item.jam_lembur > 0 ? `${item.jam_lembur} Jam` : "0"}
                          </TableCell>
                          <TableCell className="text-center border-r font-bold text-red-700 bg-red-50/20" rowSpan={2}>
                            {item.hutang_jam > 0 ? `${item.hutang_jam}` : "0"}
                          </TableCell>
                          <TableCell className="text-center font-bold text-orange-700 bg-orange-50/20" rowSpan={2}>{item.sisa_cuti}</TableCell>
                        </TableRow>

                        {/* BARIS KEDUA (LEMBUR) */}
                        <TableRow className="hover:bg-slate-50 transition-colors bg-slate-50/30">
                          <TableCell className="text-center border-r font-bold text-green-700 p-1 text-[10px]">LEMBUR</TableCell>
                          {filteredDates.map(date => {
                            const status = item.daily_status[date]?.lembur;
                            // Jika formatnya HH:mm-HH:mm, kita parse untuk input awal
                            const isTimeRange = status && status.includes('-');
                            const defaultStart = isTimeRange ? status.split('-')[0] : "14:00";
                            const defaultEnd = isTimeRange ? status.split('-')[1] : "16:00";

                            return (
                              <TableCell key={date} className={`p-1 border-r text-center cursor-pointer hover:bg-slate-100 transition-colors ${isSunday(new Date(date)) ? 'bg-red-50/30' : ''}`}>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <div className="w-full h-full min-h-[30px] flex items-center justify-center" title="Edit Jadwal Lembur">
                                      {status && status !== '-' ? (
                                        <div className={`text-[9px] font-bold px-1 py-0.5 rounded border border-green-200 bg-green-50 text-green-700 shadow-sm whitespace-nowrap`}>
                                          {status}
                                        </div>
                                      ) : (
                                        <span className="text-slate-100 italic text-[8px]">...</span>
                                      )}
                                    </div>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-64 p-3" align="center">
                                    <div className="text-[10px] font-bold mb-3 text-slate-500 uppercase flex items-center gap-2">
                                      <Clock className="w-3 h-3" /> Input Jam Lembur:
                                    </div>
                                    
                                    <div className="space-y-3">
                                      <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                          <label className="text-[9px] text-slate-400">Jam Mulai</label>
                                          <input 
                                            type="time" 
                                            id={`start-${item.pin}-${date}`}
                                            defaultValue={defaultStart}
                                            className="w-full text-xs border rounded p-1"
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <label className="text-[9px] text-slate-400">Jam Selesai</label>
                                          <input 
                                            type="time" 
                                            id={`end-${item.pin}-${date}`}
                                            defaultValue={defaultEnd}
                                            className="w-full text-xs border rounded p-1"
                                          />
                                        </div>
                                      </div>

                                      <div className="flex gap-1 pt-2 border-t">
                                        <Button
                                          className="flex-1 h-8 text-[10px] bg-green-600 hover:bg-green-700"
                                          onClick={() => {
                                            const s = (document.getElementById(`start-${item.pin}-${date}`) as HTMLInputElement).value;
                                            const e = (document.getElementById(`end-${item.pin}-${date}`) as HTMLInputElement).value;
                                            handleUpdateShift(item.pin, date, `${s}-${e}`, 'LEMBUR', s, e);
                                          }}
                                        >
                                          Simpan
                                        </Button>
                                        <Button
                                          variant="outline"
                                          className="h-8 text-[10px] text-red-500 hover:text-red-600"
                                          onClick={() => handleUpdateShift(item.pin, date, '-', 'LEMBUR')}
                                        >
                                          Hapus
                                        </Button>
                                      </div>
                                      <p className="text-[8px] text-slate-400 italic mt-2 text-center">
                                        * Menit diabaikan dalam hitungan jam kerja.
                                      </p>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      </Fragment>
                    ))}

                    <TableRow className="bg-slate-800 hover:bg-slate-800 text-white font-bold h-12 uppercase tracking-tighter">
                      <TableCell colSpan={5} className="text-right border-r px-4 text-xs">Total SDM / Shift</TableCell>
                      {filteredDates.map(date => (
                        <TableCell key={date} className="border-r p-0">
                          <div className="flex flex-col items-center justify-center text-[8px] leading-tight h-full">
                            <div className="text-blue-300">P:{columnTotals[date].P}</div>
                            <div className="text-orange-300">S:{columnTotals[date].S}</div>
                            <div className="text-purple-300">M:{columnTotals[date].M}</div>
                          </div>
                        </TableCell>
                      ))}
                      <TableCell colSpan={5} className="bg-slate-900"></TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4">
            <div>
              <p className="text-sm font-bold">Logika Perhitungan</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                - <b>Benchmark:</b> Mengikuti total jam Karu ({data[0]?.jam_aktual || 0}).<br />
                - <b>Shift:</b> P(7j), S(7j), PS(14j), M(10j), Md(7j), SID/Ct/i(7j).<br />
                - <b>Alpha:</b> Kode 'A' (0 jam) otomatis jika shift dijadwalkan tapi tidak ada scan mesin.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4">
            <div>
              <p className="text-sm font-bold">Keterangan Status</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 mt-2 w-full">
                <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded-sm flex items-center gap-1 font-medium"><b>P</b>=Pagi</span>
                <span className="text-[10px] bg-orange-50 text-orange-700 border border-orange-100 px-1.5 py-0.5 rounded-sm flex items-center gap-1 font-medium"><b>S</b>=Sore</span>
                <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-100 px-1.5 py-0.5 rounded-sm flex items-center gap-1 font-medium"><b>M</b>=Malam</span>
                <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded-sm flex items-center gap-1 font-bold"><b>PS</b>=Pagi Siang</span>
                <span className="text-[10px] bg-cyan-50 text-cyan-700 border border-cyan-100 px-1.5 py-0.5 rounded-sm flex items-center gap-1 font-medium"><b>Md</b>=Middle</span>
                <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded-sm flex items-center gap-1 font-medium"><b>L</b>=Libur</span>
                <span className="text-[10px] bg-slate-200 text-slate-700 border border-slate-300 px-1.5 py-0.5 rounded-sm flex items-center gap-1 font-medium"><b>Lm</b>=Lepas Malam</span>
                <span className="text-[10px] bg-green-50 text-green-700 border border-green-100 px-1.5 py-0.5 rounded-sm flex items-center gap-1 font-medium"><b>Ct</b>=Cuti</span>
                <span className="text-[10px] bg-green-100 text-green-800 border border-green-200 px-1.5 py-0.5 rounded-sm flex items-center gap-1 font-medium"><b>CB</b>=Cuti Bersama</span>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded-sm flex items-center gap-1 font-medium"><b>i</b>=Ijin</span>
                <span className="text-[10px] bg-red-50 text-red-700 border border-red-100 px-1.5 py-0.5 rounded-sm flex items-center gap-1 font-bold"><b>A</b>=Alpha</span>
                <span className="text-[10px] bg-yellow-50 text-yellow-700 border border-yellow-100 px-1.5 py-0.5 rounded-sm flex items-center gap-1 font-bold"><b>Oc</b>=OnCall</span>
                <span className="text-[10px] bg-pink-50 text-pink-700 border border-pink-100 px-1.5 py-0.5 rounded-sm flex items-center gap-1 font-medium"><b>SID</b>=Ijin Dokter</span>
                <span className="text-[10px] bg-teal-50 text-teal-700 border border-teal-100 px-1.5 py-0.5 rounded-sm flex items-center gap-1 font-medium"><b>SKS</b>=Seminar</span>
                <span className="text-[10px] bg-violet-50 text-violet-700 border border-violet-100 px-1.5 py-0.5 rounded-sm flex items-center gap-1 font-medium"><b>Pe</b>=Pelatihan</span>
                <span className="text-[10px] bg-slate-900 text-white border border-slate-900 px-1.5 py-0.5 rounded-sm flex items-center gap-1 font-bold"><b>X</b>=Berhenti</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
