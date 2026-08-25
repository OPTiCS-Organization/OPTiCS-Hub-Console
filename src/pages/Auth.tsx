import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, MailCheck, Loader2 } from "lucide-react";
import { useAuth, ResendCooldownError, TotpRequiredError } from "../context/Auth.context";
import TotpCodeInput from "../components/TotpCodeInput";
import Field from "../components/ui/Field";
import SubmitButton from "../components/ui/SubmitButton";
import ErrorMessage from "../components/ui/ErrorMessage";
import Checklist from "../components/ui/Checklist";
import StepHeader from "../components/ui/StepHeader";
import { useCountdown } from "../hooks/useCountdown";
import { emailRules, passwordRules, displayNameRules } from "../constants/validation";
import {
  sendVerificationEmail,
  checkVerificationCode,
  confirmExistingVerification,
  invalidReasonMessage,
} from "../lib/verification";

type Step =
  | "email"
  | "login"
  | "login-totp"         // 비밀번호는 통과, 2FA 코드 대기
  | "verify-sent"        // 인증 메일 보냄, 수신함 확인 안내
  | "verify-checking"    // 링크로 진입해 코드 확인 중
  | "verify-invalid"     // 코드가 만료/사용됨/없음
  | "register-password"
  | "register-profile"
  | "existing-done";     // 기존 사용자 재인증 완료

const API_URL = import.meta.env.VITE_API_URL as string;
const TOTP_CODE_REGEX = /^\d{6}$/;

// ── 메인 컴포넌트 ──────────────────────────────────────────

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { login, register, isAuthenticated, refreshSession } = useAuth();
  const { remaining: cooldown, start: startCooldown } = useCountdown();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [invalidMessage, setInvalidMessage] = useState("");
  const [apiError, setApiError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (field: string) => setTouched(prev => ({ ...prev, [field]: true }));

  // 메일 링크 진입 처리를 이미 했는지. state 가 아니라 ref 여야
  // 값을 바꿔도 리렌더가 나지 않고, effect 안에서 즉시 반영된다.
  const entryHandledRef = useRef(false);

  function resetTo(next: Step) {
    setStep(next);
    setApiError("");
    setNotice("");
    setTouched({});
  }

  // ── 메일 링크로 진입한 경우 ────────────────────────────
  // ?verify=<code>          신규 가입 → 코드 확인 후 가입 폼
  // ?verify-existing=<code> 기존 사용자 → 즉시 인증 완료 처리
  useEffect(() => {
    // 이 블록은 진입당 한 번만 돌아야 한다.
    // useSearchParams 의 setSearchParams 는 렌더마다 새 함수라 이 effect 가 매 렌더 실행되는데,
    // 가드가 없으면 입력 도중에도 setStep("verify-checking") 이 다시 불려 폼이 사라지고,
    // 기존 사용자 인증에서는 같은 코드로 confirm 이 두 번 호출돼 두 번째가 실패한다.
    if (entryHandledRef.current) return;

    const signupCode = searchParams.get("verify");
    const existingCode = searchParams.get("verify-existing");
    if (!signupCode && !existingCode) return;

    entryHandledRef.current = true;

    // 인증 코드가 주소창과 브라우저 기록에 남지 않도록 즉시 제거한다.
    setSearchParams({}, { replace: true });
    setStep("verify-checking");

    void (async () => {
      try {
        if (existingCode) {
          const { email: verified } = await confirmExistingVerification(existingCode);
          setEmail(verified);
          // 로그인한 채로 링크를 눌렀다면 세션을 새로 읽어 미인증 배너를 즉시 걷어낸다.
          if (isAuthenticated) await refreshSession();
          setStep("existing-done");
          return;
        }

        const result = await checkVerificationCode(signupCode!);
        if (!result.valid) {
          setInvalidMessage(invalidReasonMessage[result.reason]);
          setStep("verify-invalid");
          return;
        }

        // 가입 주소는 사용자 입력이 아니라 서버가 코드에서 꺼내준 값을 쓴다.
        setEmail(result.email);
        setVerificationCode(signupCode!);
        setStep("register-password");
      } catch (err) {
        setInvalidMessage(err instanceof Error ? err.message : "인증 링크를 확인할 수 없습니다.");
        setStep("verify-invalid");
      }
    })();
  }, [searchParams, setSearchParams, isAuthenticated, refreshSession]);

  // ── 핸들러 ────────────────────────────────────────────

  /** 쿨다운 에러는 카운트다운으로, 나머지는 에러 메시지로 처리한다. */
  function handleVerificationError(err: unknown, fallback: string) {
    if (err instanceof ResendCooldownError) {
      startCooldown(err.retryAfterSeconds);
      setApiError(err.message);
      return;
    }
    setApiError(err instanceof Error ? err.message : fallback);
  }

  async function handleEmailSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    touch("email");
    if (!emailRules.every(r => r.test(email))) return;

    setLoading(true);
    setApiError("");
    try {
      const res = await fetch(`${API_URL}/v1/auth/check-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json() as { exists: boolean };

      if (body.exists) {
        resetTo("login");
        return;
      }

      // 신규 주소면 바로 인증 메일을 보낸다. 가입 폼은 메일 링크를 눌러야 열린다.
      await sendVerificationEmail(email);
      startCooldown(90);
      resetTo("verify-sent");
    } catch (err) {
      handleVerificationError(err, "서버에 연결할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;

    setLoading(true);
    setApiError("");
    setNotice("");
    try {
      await sendVerificationEmail(email);
      startCooldown(90);
      setNotice("인증 메일을 다시 보냈습니다.");
    } catch (err) {
      handleVerificationError(err, "인증 메일 발송에 실패했습니다.");
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
      // 비밀번호는 맞았고 코드만 남은 경우다. 에러로 보여주지 않고 다음 단계로 넘어간다.
      if (err instanceof TotpRequiredError) {
        resetTo("login-totp");
        return;
      }
      setApiError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleTotpSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!TOTP_CODE_REGEX.test(totpCode)) return;

    setLoading(true);
    setApiError("");
    try {
      await login(email, password, totpCode);
      navigate("/overview");
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "인증에 실패했습니다.");
      // 실패한 코드는 지운다. 30초 주기라 같은 코드를 다시 넣어도 통과하지 않는다.
      setTotpCode("");
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
    resetTo("register-profile");
  }

  async function handleRegisterProfileSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    touch("displayName");
    if (!displayNameRules.every(r => r.test(displayName))) return;

    setLoading(true);
    setApiError("");
    try {
      await register(verificationCode, password, passwordConfirm, displayName);
      navigate("/overview");
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "회원가입에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  // ── 렌더 ──────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background-color flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="text-primary-text-color font-extrabold text-2xl leading-tight">OPTiCS</h1>
          <span className="text-secondary-text-color text-xs">Hub Console</span>
        </div>

        <div className="rounded-md border border-border-color bg-modal-background-color px-6 py-6">
          {/* 단계마다 내용 높이에 맞춘다. 예전엔 가장 긴 단계(비밀번호 설정)에 min-height 를
              맞춰 전환 시 흔들림을 없앴는데, 그러면 가장 짧고 가장 많이 보는 첫 화면이
              절반쯤 빈 카드가 된다. 단계 전환은 사용자가 직접 누른 결과라 높이가 변하는
              편이 자연스럽다. */}
          <div key={step} className="flex flex-col">

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
                onBack={() => { setPassword(""); resetTo("email"); }}
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

          {/* 로그인 2단계 — TOTP 코드 */}
          {step === "login-totp" && (
            <form onSubmit={handleTotpSubmit} className="flex flex-col gap-4">
              <StepHeader email={email} label="2단계 인증"
                onBack={() => { setTotpCode(""); setPassword(""); resetTo("login"); }}
              />
              <p className="text-secondary-text-color text-xs leading-relaxed break-keep -mt-1">
                인증 앱에 표시된 6자리 코드를 입력해 주세요.
              </p>
              <TotpCodeInput value={totpCode} onChange={setTotpCode} disabled={loading} />
              {apiError && <ErrorMessage>{apiError}</ErrorMessage>}
              <SubmitButton loading={loading} disabled={!TOTP_CODE_REGEX.test(totpCode)}>
                로그인
              </SubmitButton>
            </form>
          )}

          {/* 인증 메일 발송 완료 */}
          {step === "verify-sent" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col items-center text-center gap-3 py-2">
                <div className="w-10 h-10 rounded-md bg-white/5 flex items-center justify-center">
                  <MailCheck className="w-5 h-5 text-service-color" />
                </div>
                <div>
                  <p className="text-primary-text-color font-semibold text-sm mb-1">인증 메일을 보냈습니다</p>
                  <p className="text-secondary-text-color text-xs leading-relaxed">
                    <span className="font-mono text-primary-text-color">{email}</span> 으로<br />
                    보낸 메일의 링크를 눌러 가입을 계속해 주세요.
                  </p>
                </div>
              </div>

              <div className="rounded-sm border border-border-color bg-modal-box-color px-3 py-2.5">
                <p className="text-tertiary-text-color text-2xs leading-relaxed">
                  메일이 오지 않으면 스팸함을 확인해 주세요. 링크는 요청 시각 기준 10분간 유효합니다.
                </p>
              </div>

              {notice && <p role="status" aria-live="polite" className="text-service-color text-xs">{notice}</p>}
              {apiError && <ErrorMessage>{apiError}</ErrorMessage>}

              <button
                type="button" onClick={handleResend} disabled={cooldown > 0 || loading}
                className="w-full rounded-sm border border-border-color hover:border-border-strong-color hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed text-secondary-text-color hover:text-primary-text-color text-xs font-medium py-2 transition-colors duration-100 cursor-pointer flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-service-color/50"
              >
                {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                {cooldown > 0 ? `${cooldown}초 후 재발송 가능` : "인증 메일 다시 보내기"}
              </button>

              <button
                type="button" onClick={() => { setEmail(""); resetTo("email"); }}
                className="text-service-color text-xs hover:underline cursor-pointer rounded-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-service-color/50"
              >
                다른 이메일로 시작하기
              </button>
            </div>
          )}

          {/* 링크 확인 중 */}
          {step === "verify-checking" && (
            <div className="flex flex-col items-center text-center gap-3 py-6">
              <Loader2 className="w-5 h-5 text-service-color animate-spin" />
              <p className="text-secondary-text-color text-xs">인증 링크를 확인하는 중입니다...</p>
            </div>
          )}

          {/* 링크가 유효하지 않음 */}
          {step === "verify-invalid" && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-primary-text-color font-semibold text-sm mb-1">인증할 수 없습니다</p>
                <p className="text-secondary-text-color text-xs leading-relaxed">{invalidMessage}</p>
              </div>
              <SubmitButton type="button" onClick={() => { setEmail(""); resetTo("email"); }}>
                처음부터 다시 시작
              </SubmitButton>
            </div>
          )}

          {/* Register Step — 비밀번호 */}
          {step === "register-password" && (
            <form onSubmit={handleRegisterPasswordSubmit} className="flex flex-col gap-4">
              <div>
                <p className="text-primary-text-color font-semibold text-sm mb-1">회원가입</p>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-service-color shrink-0" />
                  <span className="text-secondary-text-color text-xs font-mono">{email}</span>
                  <span className="text-tertiary-text-color text-xs">인증됨</span>
                </div>
              </div>
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
                onBack={() => { setDisplayName(""); resetTo("register-password"); }}
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

          {/* 기존 사용자 재인증 완료 */}
          {step === "existing-done" && (
            <div className="flex flex-col gap-6 py-4">
              <div className="flex flex-col items-center text-center gap-4">
                {/* 완료 상태이므로 액센트(주황) 대신 success 색을 쓴다. 주황은 '해야 할 일'에 남겨둔다. */}
                <div className="w-14 h-14 rounded-full bg-success-color/10 border border-success-color/30 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-success-color" />
                </div>

                <div>
                  <p className="text-primary-text-color font-bold text-base mb-2 break-keep">이메일 인증 완료</p>
                  <p className="text-secondary-text-color text-xs leading-relaxed break-keep">
                    아래 주소의 인증이 정상적으로 처리되었습니다.
                  </p>
                </div>

                <div className="w-full rounded-sm border border-border-color bg-modal-box-color px-3 py-2">
                  <span className="font-mono text-primary-text-color text-xs break-all">{email}</span>
                </div>

                <p className="text-tertiary-text-color text-2xs leading-relaxed break-keep">
                  {isAuthenticated
                    ? "이제 OPTiCS의 모든 기능을 제한 없이 사용하실 수 있습니다."
                    : "이제 로그인하시면 모든 기능을 제한 없이 사용하실 수 있습니다."}
                </p>
              </div>

              {/* 링크를 누른 기기에 세션이 없을 수도 있다. 그 경우 대시보드로 보내면
                  AuthGate 가 되돌려보내므로 로그인 단계로 안내한다. */}
              {isAuthenticated ? (
                <SubmitButton type="button" onClick={() => navigate("/dashboard")}>
                  대시보드로 돌아가기
                </SubmitButton>
              ) : (
                <SubmitButton type="button" onClick={() => { setPassword(""); resetTo("login"); }}>
                  로그인하고 시작하기
                </SubmitButton>
              )}
            </div>
          )}

          </div>
        </div>
      </div>
    </div>
  );
}
