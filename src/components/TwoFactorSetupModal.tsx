import { Check, ChevronDown, Copy, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useModal } from "../context/Modal.context";
import { apiFetch } from "../lib/apiFetch";
import TotpCodeInput from "./TotpCodeInput";

type ApiResponse = {
  data?: {
    qrOtpUri?: string;
    secret?: string;
  };
  message?: string;
};

const TOTP_CODE_REGEX = /^\d{6}$/;

type TwoFactorSetupModalProps = {
  onEnabled?: () => void;
};

export default function TwoFactorSetupModal({ onEnabled }: TwoFactorSetupModalProps) {
  const { closeModal } = useModal();
  const setupRequested = useRef(false);
  const [qrOtpUri, setQrOtpUri] = useState("");
  const [secret, setSecret] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [showManualKey, setShowManualKey] = useState(false);

  async function loadSetup() {
    setIsLoading(true);
    setError("");

    try {
      const res = await apiFetch("/v1/auth/2fa/setup", { method: "POST" });
      const body = await res.json().catch(() => ({})) as ApiResponse;

      if (!res.ok || !body.data?.qrOtpUri || !body.data.secret) {
        throw new Error(body.message ?? "2단계 인증 등록 정보를 불러오지 못했습니다.");
      }

      setQrOtpUri(body.data.qrOtpUri);
      setSecret(body.data.secret);
      setTotpCode("");
      setShowManualKey(false);
      setIsCopied(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "2단계 인증 등록 정보를 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // StrictMode 개발 환경에서도 secret은 한 번만 발급한다.
    if (setupRequested.current) return;
    setupRequested.current = true;
    void loadSetup();
  }, []);

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(secret);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1500);
    } catch {
      setError("설정 키를 복사하지 못했습니다. 직접 선택해 복사해 주세요.");
    }
  }

  async function handleConfirm(event: React.FormEvent) {
    event.preventDefault();
    if (!TOTP_CODE_REGEX.test(totpCode) || isConfirming) return;

    setIsConfirming(true);
    setError("");

    try {
      // 잘못된 TOTP도 401이므로 자동 로그아웃 콜백은 전달하지 않는다.
      const res = await apiFetch("/v1/auth/2fa/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totpCode }),
      });
      const body = await res.json().catch(() => ({})) as ApiResponse;

      if (!res.ok) {
        throw new Error(body.message ?? "인증 코드가 올바르지 않습니다.");
      }

      onEnabled?.();
      setIsComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "인증 코드 확인에 실패했습니다.");
    } finally {
      setIsConfirming(false);
    }
  }

  if (isComplete) {
    return (
      <div className="flex flex-col items-center py-3 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-color/15 text-success-color">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <h2 className="mt-3 text-base font-semibold text-primary-text-color">2단계 인증이 활성화되었습니다</h2>
        <p className="mt-1 text-sm text-secondary-text-color">
          앞으로 보호된 작업을 수행할 때 인증 앱의 코드가 필요합니다.
        </p>
        <button
          type="button"
          onClick={() => closeModal({ force: true })}
          className="mt-4 cursor-pointer rounded-sm bg-service-color px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-button-progress-color"
        >
          완료
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-secondary-text-color">
        <Loader2 className="h-6 w-6 animate-spin text-service-color" />
        <p className="text-sm">등록 정보를 생성하고 있습니다...</p>
      </div>
    );
  }

  if (!qrOtpUri || !secret) {
    return (
      <div className="flex min-h-52 flex-col items-center justify-center text-center">
        <p className="text-sm text-red-400">{error || "등록 정보를 불러오지 못했습니다."}</p>
        <button
          type="button"
          onClick={() => void loadSetup()}
          className="mt-4 flex cursor-pointer items-center gap-2 rounded-sm border border-border-color px-4 py-2 text-sm text-primary-text-color transition-colors hover:bg-white/5"
        >
          <RefreshCw className="h-3.5 w-3.5" /> 다시 시도
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleConfirm} className="flex flex-col gap-3.5">
      <div>
        <p className="text-sm font-semibold text-primary-text-color">1. 인증 앱에 계정을 추가하세요</p>
        <p className="mt-0.5 text-xs leading-relaxed text-secondary-text-color">
          Google Authenticator, Microsoft Authenticator 등의 앱으로 QR 코드를 스캔하세요.
        </p>
      </div>

      <div className="flex justify-center">
        <div className="rounded-md bg-white p-2 shadow-lg">
          <img src={qrOtpUri} alt="2단계 인증 등록 QR 코드" className="h-36 w-36" />
        </div>
      </div>

      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={() => setShowManualKey(current => !current)}
          aria-expanded={showManualKey}
          aria-controls="manual-totp-key"
          className="flex cursor-pointer items-center gap-1 text-xs text-secondary-text-color transition-colors hover:text-primary-text-color"
        >
          QR 코드를 스캔할 수 없나요? 수동으로 입력
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showManualKey ? "rotate-180" : ""}`} />
        </button>

        {showManualKey && (
          <div id="manual-totp-key" className="mt-2 w-full rounded-sm border border-border-color bg-modal-box-color px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-secondary-text-color">수동 설정 키</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all text-xs tracking-wider text-primary-text-color">{secret}</code>
              <button
                type="button"
                onClick={() => void copySecret()}
                aria-label="수동 설정 키 복사"
                className="shrink-0 cursor-pointer rounded-sm p-1.5 text-secondary-text-color transition-colors hover:bg-white/5 hover:text-primary-text-color"
              >
                {isCopied ? <Check className="h-4 w-4 text-success-color" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-semibold text-primary-text-color">
          2. 앱에 표시된 6자리 코드를 입력하세요
        </p>
        <div className="mt-2">
          <TotpCodeInput value={totpCode} onChange={setTotpCode} disabled={isConfirming} />
        </div>
      </div>

      {error && (
        <div className="rounded-sm border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-400">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 border-t border-border-color pt-3">
        <button
          type="button"
          onClick={() => closeModal()}
          disabled={isConfirming}
          className="cursor-pointer rounded-sm border border-border-color px-3.5 py-1.5 text-sm text-secondary-text-color transition-colors hover:bg-white/5 hover:text-primary-text-color disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={!TOTP_CODE_REGEX.test(totpCode) || isConfirming}
          className="flex cursor-pointer items-center gap-2 rounded-sm bg-service-color px-3.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-button-progress-color disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isConfirming && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          활성화
        </button>
      </div>
    </form>
  );
}
