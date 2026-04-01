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
    <div className="min-h-screen gradient-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-card/20 backdrop-blur-sm mb-4">
            <Building2 className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-primary-foreground">RS Permata Keluarga</h1>
          <p className="text-primary-foreground/70 text-sm mt-1">HR & Attendance System — Karawang</p>
        </div>

        <Card className="shadow-2xl border-0">
          <CardHeader className="pb-4 pt-6 px-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <ShieldCheck className="w-4 h-4 text-secondary" />
              <span>Secure Login</span>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
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
              Demo: NIK <span className="font-mono bg-muted px-1 rounded">ADM001</span> / Password <span className="font-mono bg-muted px-1 rounded">admin123</span>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
