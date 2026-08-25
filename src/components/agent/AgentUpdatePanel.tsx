import { ArrowUpCircle, CheckCircle2 } from "lucide-react";
import type { Agent } from "./AgentCard";
import ReleaseNotes from "./ReleaseNotes";

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

  // 0.6.0 미만에는 update-agent 리스너가 없다. 명령을 보내면 사라지므로 버튼 대신 안내를 준다.
  if (!agent.remoteUpdateSupported) {
    return (
      <div className="rounded-md border border-warning-color/25 bg-warning-color/5 p-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <ArrowUpCircle className="w-3.5 h-3.5 text-warning-color shrink-0" />
          <span className="shrink-0 text-xs font-semibold text-primary-text-color">수동 업데이트 필요</span>
          <span className="min-w-0 truncate text-3xs font-mono text-secondary-text-color">
            {agent.agentVersion ? `${agent.agentVersion} → ` : ''}{upgrade.version}
          </span>
        </div>
        <p className="text-2xs text-secondary-text-color mt-1.5">
          이 버전은 원격 업데이트를 지원하지 않습니다. Agent 호스트에서 설치 스크립트를 직접 실행하여 업데이트하세요.
          OPTiCS Agent 0.6.0 이후 버전부터는 이 화면에서 업데이트할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-service-color/25 bg-service-color/5 p-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <ArrowUpCircle className="w-3.5 h-3.5 text-service-color shrink-0" />
        <span className="shrink-0 text-xs font-semibold text-primary-text-color">업데이트 가능</span>
        <span className="min-w-0 truncate text-3xs font-mono text-secondary-text-color">
          {agent.agentVersion ? `${agent.agentVersion} → ` : ''}{upgrade.version}
        </span>
        <button
          type="button"
          onClick={() => onUpdate(upgrade)}
          disabled={agent.agentStatus !== 'online'}
          className="ml-auto inline-flex h-7 shrink-0 items-center gap-1.5 rounded-sm bg-service-color pl-3 pr-2 text-2xs font-semibold text-white transition-opacity hover:opacity-80 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
        >
          업데이트
          {/* 채운 주황 위라 패치노트의 테두리형 BETA 배지는 읽히지 않는다.
              같은 흰 잉크를 옅게 깔아 버튼의 일부로 보이게 둔다. */}
          <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-4xs font-semibold leading-none tracking-wider">
            BETA
          </span>
        </button>
      </div>

      {agent.agentStatus !== 'online' && (
        <p className="text-3xs text-secondary-text-color mt-1.5">
          에이전트가 온라인일 때만 업데이트할 수 있습니다.
        </p>
      )}

      {upgrade.notes && (
        <div className="mt-2.5 max-h-72 overflow-y-auto border-t border-service-color/15 pt-2.5 text-secondary-text-color">
          <ReleaseNotes source={upgrade.notes} />
        </div>
      )}
    </div>
  );
}
