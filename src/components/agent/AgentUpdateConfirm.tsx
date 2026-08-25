import { useId, useState, type ReactNode } from "react";
import { ArrowRight, Loader2, Network, RotateCcw, ScrollText, Timer } from "lucide-react";

/**
 * 업데이트 확인 모달의 본문.
 *
 * 모달은 열릴 때의 ReactNode를 그대로 보관하므로 부모의 상태 변화가 반영되지 않는다.
 * 체크 여부와 전송 중 상태를 이 컴포넌트가 직접 들고 있어야 버튼이 실제로 반응한다.
 */

function Impact({
  icon,
  title,
  detail,
  emphasis,
}: {
  icon: ReactNode;
  title: string;
  detail?: string;
  /** 사용자가 놓치면 안 되는 항목. 아이콘만 경고색으로 올리고 본문은 평소 잉크를 쓴다. */
  emphasis?: boolean;
}) {
  return (
    <div className="flex gap-2.5">
      <span className={`mt-px shrink-0 ${emphasis ? 'text-warning-color' : 'text-tertiary-text-color'}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] leading-tight font-medium text-primary-text-color break-keep">{title}</p>
        {detail && (
          <p className="mt-0.5 text-[11px] leading-snug text-secondary-text-color break-keep">{detail}</p>
        )}
      </div>
    </div>
  );
}

export default function AgentUpdateConfirm({
  agentName,
  currentVersion,
  targetVersion,
  onConfirm,
  onCancel,
}: {
  agentName: string;
  currentVersion: string | null;
  targetVersion: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const checkboxId = useId();
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {/* 무엇이 어디로 가는지가 한눈에 먼저 읽혀야 한다. */}
      <div className="flex items-center gap-3 rounded-md border border-border-color bg-modal-box-color px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-primary-text-color">{agentName}</p>
          <p className="text-[10px] text-secondary-text-color">에이전트 업데이트</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 font-mono text-[11px]">
          <span className="text-secondary-text-color">{currentVersion ?? '?'}</span>
          <ArrowRight className="h-3 w-3 text-tertiary-text-color" />
          <span className="rounded-sm bg-service-color/15 px-1.5 py-0.5 font-semibold text-service-color">
            {targetVersion}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Impact
          icon={<Timer className="h-3.5 w-3.5" />}
          title="5~10초 동안 에이전트 연결이 끊깁니다"
          detail="교체가 끝나면 자동으로 다시 연결됩니다."
        />
        <Impact
          emphasis
          icon={<Network className="h-3.5 w-3.5" />}
          title="서비스 라우팅이 그동안 중단됩니다"
          detail="배포된 컨테이너는 계속 실행되지만, 이 에이전트를 경유하는 외부 요청은 실패할 수 있습니다."
        />
        <Impact
          icon={<ScrollText className="h-3.5 w-3.5" />}
          title="진행 중인 배포·로그 수집·웹 터미널이 중단됩니다"
        />
        <Impact
          icon={<RotateCcw className="h-3.5 w-3.5" />}
          title="새 버전이 시작에 실패하면 자동으로 되돌아갑니다"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-border-color pt-3">
        {/* 동의와 실행을 같은 행에 두면 무엇에 동의하고 무엇을 누르는지가 한 묶음으로 읽힌다. */}
        <label
          htmlFor={checkboxId}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2"
        >
          <input
            id={checkboxId}
            type="checkbox"
            checked={acknowledged}
            onChange={event => setAcknowledged(event.target.checked)}
            disabled={submitting}
            className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-service-color"
          />
          <span className={`text-[11px] leading-snug break-keep transition-colors ${acknowledged ? 'text-primary-text-color' : 'text-secondary-text-color'}`}>
            라우팅 중단을 포함한 위 내용을 확인했습니다.
          </span>
        </label>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="h-8 rounded-sm border border-border-color px-3 text-xs text-secondary-text-color transition-colors hover:bg-white/5 hover:text-primary-text-color cursor-pointer disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={async () => {
              setSubmitting(true);
              try {
                await onConfirm();
              } finally {
                setSubmitting(false);
              }
            }}
            disabled={!acknowledged || submitting}
            className="inline-flex h-8 items-center gap-2 rounded-sm bg-service-color px-3.5 text-xs font-semibold text-on-accent-color transition-opacity hover:opacity-80 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            업데이트
          </button>
        </div>
      </div>
    </div>
  );
}
