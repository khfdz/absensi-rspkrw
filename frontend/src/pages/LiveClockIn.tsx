import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function LiveClockIn() {
  const { toast } = useToast();
  const [time, setTime] = useState(new Date());
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = () => {
    setSubmitted(true);
    toast({ 
      title: "Absensi Berhasil!", 
      description: `Clock-in tercatat pada ${time.toLocaleTimeString("id-ID")}.` 
    });
  };

  if (submitted) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] animate-fade-in">
        <Card className="max-w-sm w-full text-center bg-card rounded-2xl border border-border shadow-card hover:shadow-elevated transition-all duration-200">
          <CardContent className="p-8 space-y-6">
            <div className="w-16 h-16 bg-success/10 text-success rounded-2xl border border-success/20 flex items-center justify-center mx-auto shadow-card">
              <CheckCircle2 className="w-10 h-10 animate-scale-in" />
            </div>
            <div className="space-y-2 animate-slide-up">
              <h2 className="text-xl font-bold text-foreground">Absensi Berhasil!</h2>
              <p className="text-muted-foreground text-sm font-medium">
                Tercatat pada {time.toLocaleDateString("id-ID")}
              </p>
              <p className="text-2xl font-bold font-mono text-primary">
                {time.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <Button variant="outline" className="w-full h-11 rounded-2xl font-bold" onClick={() => setSubmitted(false)}>
              Kembali
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6 animate-fade-in py-6">
      <div className="text-center space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Live Clock-In</h1>
        <p className="text-muted-foreground text-sm font-medium">Silakan lakukan absensi kehadiran Anda</p>
      </div>

      {/* Digital Clock Card */}
      <Card className="bg-card rounded-2xl border border-border shadow-card hover:shadow-elevated transition-all duration-200 overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-1.5 gradient-primary" />
        <CardContent className="p-10 text-center space-y-4">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold tracking-wider uppercase">
              {time.toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </span>
          </div>
          <div className="text-5xl font-bold font-mono tracking-wider text-gradient py-2">
            {time.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <Button className="w-full h-12 text-base font-bold bg-primary text-primary-foreground hover:opacity-90 transition-all rounded-2xl shadow-card" onClick={handleSubmit}>
        Submit Attendance
      </Button>
    </div>
  );
}
