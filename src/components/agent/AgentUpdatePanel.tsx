import { ArrowUpCircle, CheckCircle2 } from "lucide-react";
import type { Agent } from "./AgentCard";

/**
 * 업데이트 가능 여부와 패치노트를 보여주는 패널.
 *
 * 버전을 고르는 드롭다운은 두지 않는다. 사용자가 답해야 하는 질문은
 * "어느 버전으로 갈까"가 아니라 "지금 올릴까 말까"이기 때문이다.
 * 특정 버전으로의 고정이나 롤백은 예외 상황이고, 그때는 호스트에서 직접 다룬다.
 */
export type AgentUpgrade = NonNullable<Agent['upgrade']>;

export default function AgentUpdatePanel({
  agent,
  onUpdate,
}: {
  agent: Agent;
  onUpdate: (upgrade: AgentUpgrade) => void;
}) {
  const upgrade = agent.upgrade;
  // 업데이트가 진행 중일 때는 AgentUpdateStatus가 자리를 맡는다. 두 개를 같이 띄우지 않는다.
  const inFlight = agent.updatePhase !== 'idle';
  if (inFlight) return null;

  if (!upgrade) {
    return (
      <div className="rounded-md border border-border-color p-3 flex items-center gap-2 text-secondary-text-color">
        <CheckCircle2 className="w-3.5 h-3.5 text-success-color" />
        <span className="text-xs">최신 버전을 사용 중입니다.</span>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-service-color/25 bg-service-color/5 p-3">
      <div className="flex items-center gap-2">
        <ArrowUpCircle className="w-3.5 h-3.5 text-service-color shrink-0" />
        <span className="text-xs font-semibold text-primary-text-color">업데이트 가능</span>
        <span className="text-[10px] font-mono text-secondary-text-color">
          {agent.agentVersion ? `v${agent.agentVersion} → ` : ''}v{upgrade.version}
        </span>
        <button
          type="button"
          onClick={() => onUpdate(upgrade)}
          disabled={agent.agentStatus !== 'online'}
          className="ml-auto h-7 rounded-sm bg-service-color px-3 text-[11px] font-semibold text-white transition-opacity hover:opacity-80 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
        >
          업데이트
        </button>
      </div>

      {agent.agentStatus !== 'online' && (
        <p className="text-[10px] text-secondary-text-color mt-1.5">
          에이전트가 온라인일 때만 업데이트할 수 있습니다.
        </p>
      )}

      {upgrade.notes && (
        <pre className="text-[10px] text-secondary-text-color mt-2.5 max-h-40 overflow-y-auto whitespace-pre-wrap break-words border-t border-service-color/15 pt-2.5 font-sans">
          {upgrade.notes}
        </pre>
      )}
    </div>
  );
}
