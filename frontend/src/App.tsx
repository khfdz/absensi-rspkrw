import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, Link } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

// Pages
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import LaporanDepartemen from "@/pages/LaporanDepartemen";
import LemburFinder from "@/pages/LemburFinder";
import SyncDatabase from "@/pages/SyncDatabase";
import DataAbsensi from "@/pages/DataAbsensi";
import HakAkses from "@/pages/HakAkses";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ("IT" | "HRD" | "STAFF")[];
}

function AccessDenied() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-4 p-8 rounded-2xl bg-card border border-border shadow-card animate-scale-in">
        <div className="w-16 h-16 mx-auto rounded-full bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Akses Ditolak</h2>
        <p className="text-sm text-muted-foreground">
          Anda tidak memiliki izin (hak akses) untuk membuka halaman ini. Halaman ini hanya dapat diakses oleh bagian yang berwenang.
        </p>
        <div className="pt-2">
          <Button asChild className="gap-2">
            <Link to="/">
              <ArrowLeft className="w-4 h-4" />
              Kembali ke Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-primary text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
          <p className="font-medium animate-pulse">Memuat Sesi...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const userRole = (user?.role || "STAFF") as "IT" | "HRD" | "STAFF";

  if (allowedRoles && !allowedRoles.includes(userRole)) {
    return (
      <AppLayout>
        <AccessDenied />
      </AppLayout>
    );
  }

  return <AppLayout>{children}</AppLayout>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return null;

  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/absensi" element={<ProtectedRoute><DataAbsensi /></ProtectedRoute>} />
      <Route path="/lembur-finder" element={<ProtectedRoute><LemburFinder /></ProtectedRoute>} />
      
      {/* Khusus Role IT */}
      <Route
        path="/laporan-departemen"
        element={
          <ProtectedRoute allowedRoles={["IT"]}>
            <LaporanDepartemen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sync"
        element={
          <ProtectedRoute allowedRoles={["IT"]}>
            <SyncDatabase />
          </ProtectedRoute>
        }
      />
      <Route
        path="/hak-akses"
        element={
          <ProtectedRoute allowedRoles={["IT"]}>
            <HakAkses />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
