import { Loader2, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useModal } from '../../context/Modal.context';
import { apiFetch } from '../../lib/apiFetch';
import TotpCodeInput from '../TotpCodeInput';
import { dangerNoticeClass } from '../../constants/danger';

type TerminalAuthModalProps = {
  agentUuid: string;
  onAuthorized: (token: string) => void;
};

const TOTP_CODE_REGEX = /^\d{6}$/;

export default function TerminalAuthModal({ agentUuid, onAuthorized }: TerminalAuthModalProps) {
  const { closeModal } = useModal();
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function authorize(event: React.FormEvent) {
    event.preventDefault();
    if (!TOTP_CODE_REGEX.test(totpCode) || submitting) return;

    setSubmitting(true);
    setError('');
    try {
      const response = await apiFetch('/v1/auth/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose: 'terminal_ssh',
          agentUuid,
          totpCode,
        }),
      });
      const body = await response.json().catch(() => ({})) as {
        data?: { token?: string };
        message?: string;
      };
      if (!response.ok || !body.data?.token) {
        throw new Error(body.message ?? '터미널 권한을 발급하지 못했습니다.');
      }

      onAuthorized(body.data.token);
      closeModal({ force: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'TOTP 인증에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={authorize} className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-sm border border-service-color/30 bg-service-color/10 p-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-service-color" />
        <div>
          <p className="text-sm font-semibold text-primary-text-color">SSH 터미널 접근 인증</p>
          <p className="mt-1 text-xs leading-relaxed text-secondary-text-color">
            인증 앱에 표시된 현재 6자리 코드를 입력하세요. 발급된 권한은 이 Agent의 단일 세션에서만 사용됩니다.
          </p>
        </div>
      </div>

      <TotpCodeInput value={totpCode} onChange={setTotpCode} disabled={submitting} />

      {error && (
        <div className={`${dangerNoticeClass} text-xs text-danger-color`}>
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 border-t border-border-color pt-3">
        <button
          type="button"
          onClick={() => closeModal()}
          disabled={submitting}
          className="cursor-pointer rounded-sm border border-border-color px-3.5 py-1.5 text-sm text-secondary-text-color hover:bg-white/5 disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={!TOTP_CODE_REGEX.test(totpCode) || submitting}
          className="flex cursor-pointer items-center gap-2 rounded-sm bg-service-color px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-button-progress-color disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          인증 후 접속
        </button>
      </div>
    </form>
  );
}
