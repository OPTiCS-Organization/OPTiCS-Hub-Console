import { useState } from "react";
import { MailWarning, Loader2 } from "lucide-react";
import { useAuth, ResendCooldownError } from "../context/Auth.context";
import { useCountdown } from "../hooks/useCountdown";

/**
 * 이메일 인증 도입 이전에 가입한 사용자에게 인증을 안내하는 배너.
 * 인증을 마친 계정에서는 아무것도 렌더하지 않는다.
 */
export default function UnverifiedBanner() {
  const { needsVerification, user, requestOwnVerification } = useAuth();
  const { remaining: cooldown, start: startCooldown } = useCountdown();

  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  if (!needsVerification) return null;

  async function handleSend() {
    if (cooldown > 0) return;

    setLoading(true);
    setNotice("");
    setError("");
    try {
      await requestOwnVerification();
      startCooldown(90);
      setNotice("인증 메일을 보냈습니다. 수신함을 확인해 주세요.");
    } catch (err) {
      // 쿨다운이면 남은 초를 그대로 카운트다운에 넘긴다.
      if (err instanceof ResendCooldownError) {
        startCooldown(err.retryAfterSeconds);
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "인증 메일 발송에 실패했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-6 rounded-md border border-warning-color/30 bg-warning-color/5 px-4 py-3">
      <div className="flex items-start gap-3">
        <MailWarning className="w-4 h-4 text-warning-color shrink-0 mt-0.5" />

        <div className="flex-1 min-w-0">
          <p className="text-primary-text-color font-semibold text-sm leading-tight">이메일 인증이 필요합니다</p>
          <p className="text-secondary-text-color text-xs mt-1 leading-relaxed">
            이메일 인증 절차가 새로 도입되었습니다.{" "}
            <span className="font-mono text-primary-text-color">{user?.userEmail}</span> 으로 인증 메일을 받아 인증을 완료해 주세요.
          </p>

          {notice && <p className="text-success-color text-xs mt-2">{notice}</p>}
          {error && <p className="text-danger-color text-xs mt-2">{error}</p>}
        </div>

        {/* 아이콘은 제목 줄에 맞춰 위로, 버튼만 self-center 로 세로 중앙에 둔다. */}
        <button
          type="button" onClick={handleSend} disabled={cooldown > 0 || loading}
          className="shrink-0 self-center rounded-sm bg-service-color hover:bg-button-progress-color disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs px-3 py-1.5 transition-colors duration-100 cursor-pointer flex items-center gap-1.5"
        >
          {loading && <Loader2 className="w-3 h-3 animate-spin" />}
          {cooldown > 0 ? `${cooldown}초 후` : "인증 메일 받기"}
        </button>
      </div>
    </div>
  );
}
