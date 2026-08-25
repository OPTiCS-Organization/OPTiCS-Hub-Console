import { Loader2, ShieldOff } from "lucide-react";
import { useState } from "react";
import { useModal } from "../context/Modal.context";
import { apiFetch } from "../lib/apiFetch";
import TotpCodeInput from "./TotpCodeInput";
import { dangerNoticeClass, dangerSolidButtonClass } from "../constants/danger";

type TwoFactorDisconnectModalProps = {
  onDisconnected: () => void;
};

type ApiResponse = { message?: string };

const TOTP_CODE_REGEX = /^\d{6}$/;

export default function TwoFactorDisconnectModal({ onDisconnected }: TwoFactorDisconnectModalProps) {
  const { closeModal } = useModal();
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleDisconnect(event: React.FormEvent) {
    event.preventDefault();
    if (!TOTP_CODE_REGEX.test(totpCode) || isSubmitting) return;

    setIsSubmitting(true);
    setError("");

    try {
      // TOTP 불일치도 401이므로 자동 로그아웃 콜백은 전달하지 않는다.
      const res = await apiFetch("/v1/auth/2fa/disconnect", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totpCode }),
      });
      const body = await res.json().catch(() => ({})) as ApiResponse;

      if (!res.ok) throw new Error(body.message ?? "2단계 인증을 해제하지 못했습니다.");

      onDisconnected();
      closeModal({ force: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "2단계 인증을 해제하지 못했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleDisconnect} className="flex flex-col gap-4">
      <div className={`${dangerNoticeClass} flex items-start gap-3`}>
        <ShieldOff className="mt-0.5 h-5 w-5 shrink-0 text-danger-color" />
        <div>
          <p className="text-sm font-semibold text-primary-text-color">2단계 인증을 해제하시겠습니까?</p>
          <p className="mt-1 text-xs leading-relaxed text-secondary-text-color">
            해제 후에는 계정 보호 수준이 낮아집니다. 인증 앱의 현재 코드를 입력해 주세요.
          </p>
        </div>
      </div>

      <TotpCodeInput value={totpCode} onChange={setTotpCode} disabled={isSubmitting} />

      {error && (
        <div role="alert" aria-live="polite" className={`${dangerNoticeClass} text-xs text-danger-color`}>
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 border-t border-border-color pt-3">
        <button
          type="button"
          onClick={() => closeModal()}
          disabled={isSubmitting}
          className="inline-flex h-8 cursor-pointer items-center justify-center rounded-sm border border-border-color px-3.5 text-xs text-secondary-text-color transition-colors hover:bg-white/5 hover:text-primary-text-color disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-service-color/50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={!TOTP_CODE_REGEX.test(totpCode) || isSubmitting}
          className={`${dangerSolidButtonClass} focus-visible:ring-offset-2 focus-visible:ring-offset-modal-background-color`}
        >
          {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          2단계 인증 해제
        </button>
      </div>
    </form>
  );
}
