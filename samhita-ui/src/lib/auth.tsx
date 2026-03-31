"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";

interface AuthState {
  email: string;
  role: "doctor" | "admin";
  loggedIn: boolean;
}

interface AuthContextType extends AuthState {
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  email: "",
  role: "admin",
  loggedIn: false,
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [auth, setAuth] = useState<AuthState>({ email: "", role: "admin", loggedIn: false });
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("samhita_auth");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.loggedIn) {
          setAuth({ email: parsed.email, role: parsed.role || "admin", loggedIn: true });
          setChecked(true);
          return;
        }
      }
    } catch {}
    router.replace("/login");
  }, [router]);

  const logout = () => {
    localStorage.removeItem("samhita_auth");
    setAuth({ email: "", role: "admin", loggedIn: false });
    router.replace("/login");
  };

  if (!checked) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ ...auth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
