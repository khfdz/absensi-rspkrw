import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

interface User {
  nik: string;
  nama: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (nik: string, password: string) => Promise<boolean>;
  logout: () => void;
  validatePassword: (password: string) => boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API_URL = "http://localhost:3103/api/auth";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkMe = useCallback(async () => {
    const token = localStorage.getItem("hr_token");
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        localStorage.removeItem("hr_token");
        localStorage.removeItem("hr_user");
        setUser(null);
      }
    } catch (error) {
      console.error("Failed to validate token:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem("hr_user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    checkMe();
  }, [checkMe]);

  const login = useCallback(async (nik: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nik, password }),
      });

      if (response.ok) {
        const data = await response.json();
        const userData = data.user;
        setUser(userData);
        localStorage.setItem("hr_token", data.token);
        localStorage.setItem("hr_user", JSON.stringify(userData));
        return true;
      }
      return false;
    } catch (error) {
      console.error("Login request failed:", error);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("hr_token");
    localStorage.removeItem("hr_user");
  }, []);

  const validatePassword = useCallback((password: string) => {
    // Note: In real app, this should be a backend check
    // For now, keeping it as a placeholder or you might need a dedicated API
    console.warn("validatePassword is not implemented for production yet");
    return true; 
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, validatePassword, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
