import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { apiFetch } from "../lib/apiFetch";

export type UserPermission = "unverified" | "verified" | "moderator" | "administrator";

interface AuthUser {
  userDisplay: string;
  userEmail: string;
  userPermission: UserPermission;
}

interface AuthContextType {
  isAuthenticated: boolean | null; // null = 초기 확인 중
  user: AuthUser | null;
  /** 이메일 인증을 아직 마치지 않은 계정인지. 인증 안내 배너 노출 조건. */
  needsVerification: boolean;
  /** 2FA를 켠 계정이면 totpCode 없이 부를 때 TotpRequiredError 를 던진다. */
  login: (email: string, password: string, totpCode?: string) => Promise<void>;
  /** 이메일이 아니라 인증 코드로 가입한다. 가입 주소는 서버가 코드에서 꺼낸다. */
  register: (verificationCode: string, password: string, passwordConfirm: string, display: string) => Promise<void>;
  /** 로그인한 미인증 사용자가 자기 주소로 인증 메일을 재요청한다. */
  requestOwnVerification: () => Promise<void>;
  refreshSession: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

/**
 * 서버가 쿨다운 중이라고 응답할 때 함께 주는 남은 초.
 * 카운트다운을 띄우기 위해 에러에 실어 올린다.
 */
export class ResendCooldownError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super(`${retryAfterSeconds}초 후에 다시 요청할 수 있습니다.`);
    this.name = "ResendCooldownError";
  }
}

/** 비밀번호는 맞았고 TOTP 코드만 더 필요한 상태. Hub 의 Code.Authentication.TOTP_REQUIRED. */
export class TotpRequiredError extends Error {
  constructor() {
    super("2단계 인증 코드가 필요합니다.");
    this.name = "TotpRequiredError";
  }
}

const TOTP_REQUIRED_CODE = "A0F6";

/** 실패 응답에서 메시지를 꺼낸다. 쿨다운·2FA 요구는 전용 에러로 바꿔 던진다. */
async function throwApiError(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => ({})) as {
    message?: string;
    retryAfterSeconds?: number;
    code?: string;
  };

  if (res.status === 429 && typeof body.retryAfterSeconds === "number") {
    throw new ResendCooldownError(body.retryAfterSeconds);
  }

  if (body.code === TOTP_REQUIRED_CODE) {
    throw new TotpRequiredError();
  }

  throw new Error(body.message ?? fallback);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  const forceLogout = useCallback(() => {
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const loadSession = useCallback(async () => {
    const res = await apiFetch("/v1/auth/me", {}, forceLogout);
    if (!res.ok) {
      setUser(null);
      setIsAuthenticated(false);
      return;
    }
    const body = await res.json().catch(() => ({})) as { data?: { user?: AuthUser } };
    setUser(body.data?.user ?? null);
    setIsAuthenticated(true);
  }, [forceLogout]);

  // 앱 최초 진입 시 쿠키 유효성 확인
  useEffect(() => {
    void Promise.resolve().then(loadSession).catch(e => { console.error(e); forceLogout(); });
  }, [forceLogout, loadSession]);

  async function login(email: string, password: string, totpCode?: string) {
    // 2FA 코드 불일치도 401 이라 자동 로그아웃 콜백은 넘기지 않는다.
    // 넘기면 코드 오타 한 번에 세션이 끊긴다.
    const res = await apiFetch("/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(totpCode ? { email, password, totpCode } : { email, password }),
    });

    if (!res.ok) await throwApiError(res, "로그인에 실패했습니다.");

    await loadSession();
  }

  async function register(verificationCode: string, password: string, passwordConfirm: string, display: string) {
    const res = await apiFetch("/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verificationCode, password, passwordConfirm, display }),
    }, forceLogout);

    if (!res.ok) await throwApiError(res, "회원가입에 실패했습니다.");

    await loadSession();
  }

  async function requestOwnVerification() {
    const res = await apiFetch("/v1/auth/verify/me", { method: "POST" }, forceLogout);

    if (!res.ok) await throwApiError(res, "인증 메일 발송에 실패했습니다.");
  }

  function logout() {
    setUser(null);
    setIsAuthenticated(false);
    // 필요 시 /auth/logout 엔드포인트 호출
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        needsVerification: user?.userPermission === "unverified",
        login,
        register,
        requestOwnVerification,
        refreshSession: loadSession,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
