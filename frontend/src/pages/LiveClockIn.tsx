import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, QrCode, MapPin, Clock, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const HOSPITAL_LAT = -6.3232;
const HOSPITAL_LNG = 107.3376;
const RADIUS_METERS = 500;

function getDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function LiveClockIn() {
  const { toast } = useToast();
  const [time, setTime] = useState(new Date());
  const [gpsStatus, setGpsStatus] = useState<"loading" | "within" | "outside" | "error">("loading");
  const [scannerActive, setScannerActive] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus("error");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const dist = getDistance(pos.coords.latitude, pos.coords.longitude, HOSPITAL_LAT, HOSPITAL_LNG);
        setGpsStatus(dist <= RADIUS_METERS ? "within" : "outside");
      },
      () => setGpsStatus("within") // fallback for demo
    );
  }, []);

  const handleSubmit = () => {
    setSubmitted(true);
    toast({ title: "Absensi Berhasil!", description: `Clock-in tercatat pada ${time.toLocaleTimeString("id-ID")}.` });
  };

  const gpsBadge = {
    loading: { label: "Mendeteksi...", className: "bg-warning/10 text-warning border-warning/20 animate-pulse-soft" },
    within: { label: "Dalam Radius RS", className: "bg-success/10 text-success border-success/20" },
    outside: { label: "Di Luar Radius", className: "bg-destructive/10 text-destructive border-destructive/20" },
    error: { label: "GPS Tidak Tersedia", className: "bg-muted text-muted-foreground" },
  }[gpsStatus];

  if (submitted) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] animate-fade-in">
        <Card className="max-w-sm w-full text-center">
          <CardContent className="p-8 space-y-4">
            <CheckCircle2 className="w-16 h-16 text-success mx-auto" />
            <h2 className="text-xl font-bold">Absensi Berhasil!</h2>
            <p className="text-muted-foreground">Tercatat pada {time.toLocaleDateString("id-ID")} — {time.toLocaleTimeString("id-ID")}</p>
            <Button variant="outline" onClick={() => setSubmitted(false)}>Kembali</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Live Clock-In</h1>
        <p className="text-muted-foreground text-sm">Halaman absensi karyawan</p>
      </div>

      {/* Digital Clock */}
      <Card>
        <CardContent className="p-8 text-center">
          <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2">
            <Clock className="w-4 h-4" />
            <span className="text-sm">{time.toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
          </div>
          <div className="text-5xl font-bold font-mono tracking-wider text-gradient">
            {time.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
        </CardContent>
      </Card>

      {/* Camera Placeholder */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Camera className="w-4 h-4" /> Selfie / Foto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="aspect-[4/3] bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-border">
            <div className="text-center text-muted-foreground">
              <Camera className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Kamera akan aktif di perangkat mobile</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Barcode Scanner Toggle & GPS */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="cursor-pointer" onClick={() => setScannerActive(!scannerActive)}>
          <CardContent className="p-4 text-center">
            <QrCode className={`w-8 h-8 mx-auto mb-2 ${scannerActive ? "text-primary" : "text-muted-foreground"}`} />
            <p className="text-xs font-medium">{scannerActive ? "Scanner Aktif" : "Barcode Scanner"}</p>
            <Badge variant="outline" className={`mt-2 text-xs ${scannerActive ? "bg-primary/10 text-primary border-primary/20" : ""}`}>
              {scannerActive ? "ON" : "OFF"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <MapPin className={`w-8 h-8 mx-auto mb-2 ${gpsStatus === "within" ? "text-success" : "text-muted-foreground"}`} />
            <p className="text-xs font-medium">Lokasi GPS</p>
            <span className={`inline-flex mt-2 px-2 py-0.5 rounded-full text-xs font-medium border ${gpsBadge.className}`}>
              {gpsBadge.label}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Submit */}
      <Button className="w-full h-12 text-base" onClick={handleSubmit}>
        Submit Attendance
      </Button>
    </div>
  );
}
