import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { apiFetch } from "../lib/apiFetch";

interface AuthContextType {
  isAuthenticated: boolean | null; // null = 초기 확인 중
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, passwordConfirm: string, display: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const forceLogout = useCallback(() => setIsAuthenticated(false), []);

  // 앱 최초 진입 시 쿠키 유효성 확인
  useEffect(() => {
    apiFetch("/auth/me", {}, forceLogout)
      .then(res => setIsAuthenticated(res.ok))
      .catch(() => setIsAuthenticated(false));
  }, [forceLogout]);

  async function login(email: string, password: string) {
    const res = await apiFetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }, forceLogout);

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { message?: string };
      throw new Error(body.message ?? "로그인에 실패했습니다.");
    }

    setIsAuthenticated(true);
  }

  async function register(email: string, password: string, passwordConfirm: string, display: string) {
    const res = await apiFetch("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, passwordConfirm, display }),
    }, forceLogout);

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { message?: string };
      throw new Error(body.message ?? "회원가입에 실패했습니다.");
    }

    setIsAuthenticated(true);
  }

  function logout() {
    setIsAuthenticated(false);
    // 필요 시 /auth/logout 엔드포인트 호출
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
