import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Building2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [nik, setNik] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const success = await login(nik, password);
    setLoading(false);
    if (!success) {
      toast({ title: "Login Gagal", description: "NIK atau Password salah.", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-neutral-50 to-neutral-100/40 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <img
            src="/image/logoBersih.png"
            alt="Logo RS Permata Keluarga"
            className="h-20 w-auto mx-auto mb-4 object-contain filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.06)] animate-scale-in"
          />
          <h1 className="text-2xl font-bold text-foreground tracking-tight">RS Permata Keluarga</h1>
          <p className="text-muted-foreground text-sm mt-1.5 font-medium">HR & Attendance System — Karawang</p>
        </div>

        <Card className="bg-card rounded-2xl border border-border shadow-float p-2 hover:shadow-elevated transition-all duration-200">

          <CardContent className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2 mt-4">
                <Label htmlFor="nik">NIK (Username)</Label>
                <Input
                  id="nik"
                  placeholder="Masukkan NIK Anda"
                  value={nik}
                  onChange={e => setNik(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Masukkan Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember"
                    checked={remember}
                    onCheckedChange={(v) => setRemember(v as boolean)}
                  />
                  <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                    Ingat Saya
                  </Label>
                </div>
                <button type="button" className="text-sm text-primary hover:underline">
                  Lupa Password?
                </button>
              </div>

              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? "Memproses..." : "Masuk"}
              </Button>
            </form>

            <p className="text-xs text-center text-muted-foreground mt-6">
              <span className="font-mono bg-muted px-1 rounded">Login menggunakan akun SIMRS KHANZA
              </span>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
