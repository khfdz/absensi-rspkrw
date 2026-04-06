export interface Pegawai {
  id: string;
  nik: string;
  nama: string;
  jk: "L" | "P";
  jbtn: string;
  jnj_jabatan: string;
  departemen: string;
  bidang: string;
  stts_aktif: "Aktif" | "Non-Aktif" | "Cuti";
  tgl_masuk: string;
  no_telp: string;
  alamat: string;
}

export interface Absensi {
  id: string;
  nik: string;
  nama: string;
  departemen: string;
  tanggal: string;
  jam_masuk: string | null;
  jam_pulang: string | null;
  status: "Masuk" | "Pulang" | "Tidak Hadir" | "Izin";
  lat: number;
  lng: number;
}

export const pegawaiData: Pegawai[] = [
  { id: "1", nik: "PEG001", nama: "Dr. Siti Rahayu", jk: "P", jbtn: "Dokter Umum", jnj_jabatan: "Dokter", departemen: "IGD", bidang: "Medis", stts_aktif: "Aktif", tgl_masuk: "2020-01-15", no_telp: "081234567890", alamat: "Jl. Tuparev No. 10 Karawang" },
  { id: "2", nik: "PEG002", nama: "Ahmad Fauzi", jk: "L", jbtn: "Perawat Senior", jnj_jabatan: "Perawat", departemen: "Rawat Inap", bidang: "Keperawatan", stts_aktif: "Aktif", tgl_masuk: "2019-06-01", no_telp: "081234567891", alamat: "Jl. Galuh Mas Karawang" },
  { id: "3", nik: "PEG003", nama: "Dewi Lestari", jk: "P", jbtn: "Apoteker", jnj_jabatan: "Farmasi", departemen: "Farmasi", bidang: "Penunjang Medis", stts_aktif: "Aktif", tgl_masuk: "2021-03-20", no_telp: "081234567892", alamat: "Jl. Kertabumi No. 5 Karawang" },
  { id: "4", nik: "PEG004", nama: "Budi Santoso", jk: "L", jbtn: "Admin Keuangan", jnj_jabatan: "Staff", departemen: "Keuangan", bidang: "Administrasi", stts_aktif: "Aktif", tgl_masuk: "2018-11-10", no_telp: "081234567893", alamat: "Jl. Ahmad Yani Karawang" },
  { id: "5", nik: "PEG005", nama: "Rina Wulandari", jk: "P", jbtn: "Bidan", jnj_jabatan: "Bidan", departemen: "Kebidanan", bidang: "Medis", stts_aktif: "Cuti", tgl_masuk: "2022-01-05", no_telp: "081234567894", alamat: "Jl. Bypass Karawang" },
  { id: "6", nik: "PEG006", nama: "Hendra Gunawan", jk: "L", jbtn: "IT Support", jnj_jabatan: "Staff", departemen: "IT", bidang: "Penunjang", stts_aktif: "Aktif", tgl_masuk: "2021-07-15", no_telp: "081234567895", alamat: "Jl. Interchange Karawang Barat" },
  { id: "7", nik: "PEG007", nama: "Maya Sari", jk: "P", jbtn: "HRD Staff", jnj_jabatan: "Staff", departemen: "HRD", bidang: "Administrasi", stts_aktif: "Aktif", tgl_masuk: "2020-09-01", no_telp: "081234567896", alamat: "Jl. Surotokunto Karawang" },
  { id: "8", nik: "PEG008", nama: "Yusuf Pratama", jk: "L", jbtn: "Radiografer", jnj_jabatan: "Penunjang Medis", departemen: "Radiologi", bidang: "Penunjang Medis", stts_aktif: "Non-Aktif", tgl_masuk: "2017-04-20", no_telp: "081234567897", alamat: "Jl. Kosambi Karawang" },
];

export const absensiData: Absensi[] = [
  { id: "1", nik: "PEG001", nama: "Dr. Siti Rahayu", departemen: "IGD", tanggal: "2026-04-01", jam_masuk: "07:05", jam_pulang: "14:10", status: "Pulang", lat: -6.3231, lng: 107.3376 },
  { id: "2", nik: "PEG002", nama: "Ahmad Fauzi", departemen: "Rawat Inap", tanggal: "2026-04-01", jam_masuk: "06:55", jam_pulang: null, status: "Masuk", lat: -6.3233, lng: 107.3378 },
  { id: "3", nik: "PEG003", nama: "Dewi Lestari", departemen: "Farmasi", tanggal: "2026-04-01", jam_masuk: "07:30", jam_pulang: "15:00", status: "Pulang", lat: -6.3230, lng: 107.3375 },
  { id: "4", nik: "PEG004", nama: "Budi Santoso", departemen: "Keuangan", tanggal: "2026-04-01", jam_masuk: null, jam_pulang: null, status: "Izin", lat: 0, lng: 0 },
  { id: "5", nik: "PEG006", nama: "Hendra Gunawan", departemen: "IT", tanggal: "2026-04-01", jam_masuk: "07:00", jam_pulang: null, status: "Masuk", lat: -6.3234, lng: 107.3377 },
  { id: "6", nik: "PEG007", nama: "Maya Sari", departemen: "HRD", tanggal: "2026-04-01", jam_masuk: "07:15", jam_pulang: "14:30", status: "Pulang", lat: -6.3232, lng: 107.3376 },
  { id: "7", nik: "PEG001", nama: "Dr. Siti Rahayu", departemen: "IGD", tanggal: "2026-03-31", jam_masuk: "07:10", jam_pulang: "14:05", status: "Pulang", lat: -6.3231, lng: 107.3376 },
  { id: "8", nik: "PEG002", nama: "Ahmad Fauzi", departemen: "Rawat Inap", tanggal: "2026-03-31", jam_masuk: "06:50", jam_pulang: "14:00", status: "Pulang", lat: -6.3233, lng: 107.3378 },
];

export const DEPARTEMEN_LIST = ["IGD", "Rawat Inap", "Farmasi", "Keuangan", "Kebidanan", "IT", "HRD", "Radiologi", "KB"];
export const BIDANG_LIST = ["Medis", "Keperawatan", "Penunjang Medis", "Administrasi", "Penunjang"];
export const JNJ_JABATAN_LIST = ["Dokter", "Perawat", "Farmasi", "Staff", "Bidan", "Penunjang Medis"];
