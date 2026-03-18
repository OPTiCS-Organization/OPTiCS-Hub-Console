import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, X } from "lucide-react";
import { useAuth } from "../context/Auth.context";

type Step = "email" | "login" | "register-password" | "register-profile";

// ── 유효성 규칙 ──────────────────────────────────────────

const emailRules = [
  { label: "올바른 이메일 형식", test: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) },
];

const passwordRules = [
  { label: "8자 이상", test: (v: string) => v.length >= 8 },
  { label: "영문으로 작성됨", test: (v: string) => /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]+$/.test(v) },
  { label: "소문자 또는 대문자 포함", test: (v: string) => /[a-zA-Z]/.test(v) },
  { label: "특수문자 포함", test: (v: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(v) },
];

const displayNameRules = [
  { label: "3자 이상", test: (v: string) => v.length >= 3 },
  { label: "-, _ 외 특수문자 사용 불가", test: (v: string) => /^[a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ\-_]+$/.test(v) },
];

const API_URL = import.meta.env.VITE_API_URL as string;

// ── 메인 컴포넌트 ──────────────────────────────────────────

export default function Auth() {
  const navigate = useNavigate();
  const { login, register } = useAuth();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(false);

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (field: string) => setTouched(prev => ({ ...prev, [field]: true }));

  async function handleEmailSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    touch("email");
    if (!emailRules.every(r => r.test(email))) return;

    setLoading(true);
    setApiError("");
    try {
      const res = await fetch(`${API_URL}/auth/check-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json() as { exists: boolean };
      setStep(body.exists ? "login" : "register-password");
    } catch {
      setApiError("서버에 연결할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLoginSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    touch("password");
    if (!password) return;

    setLoading(true);
    setApiError("");
    try {
      await login(email, password);
      navigate("/overview");
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function handleRegisterPasswordSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    touch("password"); touch("passwordConfirm");
    const valid =
      passwordRules.every(r => r.test(password)) &&
      password === passwordConfirm;
    if (!valid) return;
    setStep("register-profile");
    setTouched({});
  }

  async function handleRegisterProfileSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    touch("displayName");
    if (!displayNameRules.every(r => r.test(displayName))) return;

    setLoading(true);
    setApiError("");
    try {
      await register(email, password, passwordConfirm, displayName);
      navigate("/overview");
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "회원가입에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background-color flex items-center justify-center">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="text-primary-text-color font-extrabold text-2xl leading-tight">OPTiCS</h1>
          <span className="text-secondary-text-color text-xs">Hub Console</span>
        </div>

        <div className="rounded-md border border-border-color bg-modal-background-color px-6 py-6">

          {/* Email Step */}
          {step === "email" && (
            <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
              <div>
                <p className="text-primary-text-color font-semibold text-sm mb-1">시작하기</p>
                <p className="text-secondary-text-color text-xs">이메일을 입력하면 로그인 또는 회원가입으로 안내합니다.</p>
              </div>
              <Field
                label="이메일" type="email" value={email}
                onChange={v => { setEmail(v); touch("email"); }}
                placeholder="you@example.com" autoFocus
              />
              {touched.email && <Checklist rules={emailRules} value={email} />}
              {apiError && <ErrorMessage>{apiError}</ErrorMessage>}
              <SubmitButton loading={loading}>계속</SubmitButton>
            </form>
          )}

          {/* Login Step */}
          {step === "login" && (
            <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
              <StepHeader email={email} label="로그인"
                onBack={() => { setStep("email"); setPassword(""); setApiError(""); setTouched({}); }}
              />
              <Field
                label="비밀번호" type="password" value={password}
                onChange={v => { setPassword(v); touch("password"); }}
                placeholder="비밀번호 입력" autoFocus
              />
              {apiError && <ErrorMessage>{apiError}</ErrorMessage>}
              <SubmitButton loading={loading}>로그인</SubmitButton>
            </form>
          )}

          {/* Register Step — 비밀번호 */}
          {step === "register-password" && (
            <form onSubmit={handleRegisterPasswordSubmit} className="flex flex-col gap-4">
              <StepHeader email={email} label="회원가입"
                onBack={() => { setStep("email"); setPassword(""); setPasswordConfirm(""); setApiError(""); setTouched({}); }}
              />
              <Field
                label="비밀번호" type="password" value={password}
                onChange={v => { setPassword(v); touch("password"); }}
                placeholder="비밀번호 입력" autoFocus
              />
              {touched.password && <Checklist rules={passwordRules} value={password} />}
              <Field
                label="비밀번호 확인" type="password" value={passwordConfirm}
                onChange={v => { setPasswordConfirm(v); touch("passwordConfirm"); }}
                placeholder="비밀번호 재입력"
              />
              {touched.passwordConfirm && (
                <Checklist
                  rules={[{ label: "비밀번호 일치", test: (v) => v === password }]}
                  value={passwordConfirm}
                />
              )}
              <SubmitButton loading={loading}>계속</SubmitButton>
            </form>
          )}

          {/* Register Step — 프로필 */}
          {step === "register-profile" && (
            <form onSubmit={handleRegisterProfileSubmit} className="flex flex-col gap-4">
              <StepHeader email={email} label="회원가입"
                onBack={() => { setStep("register-password"); setDisplayName(""); setApiError(""); setTouched({}); }}
              />
              <Field
                label="닉네임" type="text" value={displayName}
                onChange={v => { setDisplayName(v); touch("displayName"); }}
                placeholder="표시될 이름" autoFocus
              />
              {touched.displayName && <Checklist rules={displayNameRules} value={displayName} />}
              {apiError && <ErrorMessage>{apiError}</ErrorMessage>}
              <SubmitButton loading={loading}>가입하기</SubmitButton>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}

// ── 내부 컴포넌트 ──────────────────────────────────────────

function Checklist({ rules, value }: { rules: { label: string; test: (v: string) => boolean }[]; value: string }) {
  return (
    <ul className="flex flex-col gap-1 -mt-2">
      {rules.map(rule => {
        const passed = rule.test(value);
        return (
          <li key={rule.label} className={`flex items-center gap-1.5 text-xs transition-colors duration-150 ${passed ? "text-service-color" : "text-secondary-text-color"}`}>
            {passed ? <Check className="w-3 h-3 shrink-0" /> : <X className="w-3 h-3 shrink-0" />}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}

function Field({ label, type, value, onChange, placeholder, autoFocus }: {
  label: string; type: string; value: string;
  onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] text-secondary-text-color font-medium uppercase tracking-widest">{label}</label>
      <input
        type={type} value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder} autoFocus={autoFocus}
        className="w-full bg-modal-box-color border border-border-color rounded-sm px-3 py-2 text-sm text-primary-text-color placeholder:text-secondary-text-color/50 outline-none focus:border-service-color transition-colors duration-100"
      />
    </div>
  );
}

function StepHeader({ email, onBack, label }: { email: string; onBack: () => void; label: string }) {
  return (
    <div>
      <p className="text-primary-text-color font-semibold text-sm mb-1">{label}</p>
      <div className="flex items-center gap-1.5">
        <span className="text-secondary-text-color text-xs">{email}</span>
        <button type="button" onClick={onBack} className="text-service-color text-xs hover:underline cursor-pointer">변경</button>
      </div>
    </div>
  );
}

function SubmitButton({ children, loading }: { children: React.ReactNode; loading?: boolean }) {
  return (
    <button
      type="submit" disabled={loading}
      className="w-full bg-service-color hover:bg-button-progress-color disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm py-2 rounded-sm transition-colors duration-100 cursor-pointer"
    >
      {loading ? "처리 중..." : children}
    </button>
  );
}

function ErrorMessage({ children }: { children: React.ReactNode }) {
  return <p className="text-red-400 text-xs">{children}</p>;
}
