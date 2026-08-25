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

  /**
   * 브라우저에 남는 계정 흔적을 지운다.
   *
   * localStorage 는 시크릿 모드나 쿠키 차단 설정에서 접근만 해도 예외를 던지므로
   * 실패를 흘린다. 여기서 화면이 죽으면 로그아웃 자체가 막힌다.
   * 패치노트 확인 여부는 계정이 아니라 이 브라우저의 취향이라 남겨 둔다.
   */
  function clearLocalAccountData() {
    try {
      localStorage.removeItem("currentWorkspaceIndex");
    } catch {
      /* 지우지 못해도 다음 로그인에서 목록에 없는 워크스페이스는 걸러진다. */
    }
  }

  // 서버가 401 로 세션을 끊은 경우. 이미 무효한 세션이라 서버를 다시 부르지 않는다.
  const forceLogout = useCallback(() => {
    clearLocalAccountData();
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

  /**
   * 사용자가 직접 누른 로그아웃.
   *
   * 화면만 /auth 로 보내면 httpOnly 쿠키와 서버의 Refresh Token 이 그대로 남아
   * 새로고침 한 번에 세션이 되살아난다. 서버에 토큰 폐기와 쿠키 삭제를 맡기고,
   * 브라우저에 남은 계정 흔적도 함께 지운다.
   *
   * 화면 전환은 서버 응답을 기다리지 않는다. 네트워크가 끊긴 상태에서 로그아웃이
   * 먹지 않는 것처럼 보이면 안 되고, 폐기는 실패해도 다음 요청에서 401 로 정리된다.
   */
  function logout() {
    clearLocalAccountData();
    setUser(null);
    setIsAuthenticated(false);

    void apiFetch("/v1/auth/logout", { method: "POST" }).catch(() => {
      /* 폐기 실패는 사용자가 할 수 있는 일이 없다. 화면은 이미 로그아웃 상태다. */
    });
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
