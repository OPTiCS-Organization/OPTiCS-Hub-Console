import { Loader2, ShieldOff } from "lucide-react";
import { useState } from "react";
import { useModal } from "../context/Modal.context";
import { apiFetch } from "../lib/apiFetch";
import TotpCodeInput from "./TotpCodeInput";

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
      <div className="flex items-start gap-3 rounded-sm border border-danger-color/30 bg-danger-color/10 p-3">
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
        <div className="rounded-sm border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-400">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 border-t border-border-color pt-3">
        <button
          type="button"
          onClick={() => closeModal()}
          disabled={isSubmitting}
          className="cursor-pointer rounded-sm border border-border-color px-3.5 py-1.5 text-sm text-secondary-text-color transition-colors hover:bg-white/5 hover:text-primary-text-color disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={!TOTP_CODE_REGEX.test(totpCode) || isSubmitting}
          className="flex cursor-pointer items-center gap-2 rounded-sm border border-danger-color bg-danger-color/10 px-3.5 py-1.5 text-sm font-semibold text-danger-color transition-colors hover:bg-danger-color hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          2단계 인증 해제
        </button>
      </div>
    </form>
  );
}
