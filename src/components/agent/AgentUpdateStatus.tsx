import { Loader2, CheckCircle2, AlertTriangle, Undo2, ArrowUpCircle } from "lucide-react";
import type { Agent } from "./AgentCard";

export type UpdatePhase = Agent['updatePhase'];

/**
 * 업데이트는 5~10초의 다운타임을 동반하고, 그 사이 Agent는 소켓이 끊긴다.
 * 아무것도 보여주지 않으면 사용자에게는 정상 동작이 아니라 사고로 보인다.
 * 그래서 단계마다 "지금 무슨 일이 벌어지는지"와 "기다려도 되는지"를 같이 말해준다.
 */
const PHASE: Record<Exclude<UpdatePhase, 'idle'>, {
  label: string;
  detail: string;
  tone: string;
  spinning: boolean;
}> = {
  requested: {
    label: '업데이트 요청됨',
    detail: '에이전트가 업데이트 작업을 준비하고 있습니다.',
    tone: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    spinning: true,
  },
  pulling: {
    label: '이미지 내려받는 중',
    detail: '교체할 버전의 에이전트 이미지를 내려받는 중 입니다. 이 단계에서는 중단되지 않습니다.',
    tone: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    spinning: true,
  },
  restarting: {
    label: '재시작 중',
    detail: '에이전트가 교체되는 동안 10초 간 연결이 끊깁니다. 배포된 서비스는 중단되지 않습니다..',
    tone: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    spinning: true,
  },
  succeeded: {
    label: '업데이트 완료',
    detail: '새 버전으로 정상 기동했습니다.',
    tone: 'text-green-400 bg-green-500/10 border-green-500/20',
    spinning: false,
  },
  rolled_back: {
    label: '되돌려짐',
    detail: '새 버전이 기동에 실패해 이전 버전으로 복구했습니다.',
    tone: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    spinning: false,
  },
  failed: {
    label: '업데이트 실패',
    detail: "에이전트 호스트에서 'docker logs optics-agent-updater'로 원인을 확인하세요.",
    tone: 'text-red-400 bg-red-500/10 border-red-500/20',
    spinning: false,
  },
};

function PhaseIcon({ phase, spinning }: { phase: Exclude<UpdatePhase, 'idle'>; spinning: boolean }) {
  if (spinning) return <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />;
  if (phase === 'succeeded') return <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />;
  if (phase === 'rolled_back') return <Undo2 className="w-3.5 h-3.5 shrink-0" />;
  return <AlertTriangle className="w-3.5 h-3.5 shrink-0" />;
}

/**
 * 카드에 얹는 한 줄짜리 요약.
 * 진행 중이 아니더라도 올릴 수 있는 버전이 있으면 알린다.
 * 목록에서 보이지 않으면 사용자는 에이전트마다 상세로 들어가 봐야 업데이트 존재를 알게 된다.
 */
export function AgentUpdateBadge({ agent, upgradeTo }: { agent: Agent; upgradeTo?: string | null }) {
  if (agent.updatePhase === 'idle') {
    if (!upgradeTo) return null;
    return (
      <div className="px-4 py-1.5 border-t border-service-color/20 bg-service-color/5 flex items-center gap-1.5 text-[10px] text-service-color">
        <ArrowUpCircle className="w-3.5 h-3.5 shrink-0" />
        <span className="font-medium">업데이트 가능</span>
        <span className="font-mono opacity-70">v{upgradeTo}</span>
      </div>
    );
  }
  const phase = PHASE[agent.updatePhase];

  return (
    <div className={`px-4 py-1.5 border-t flex items-center gap-1.5 text-[10px] ${phase.tone}`}>
      <PhaseIcon phase={agent.updatePhase} spinning={phase.spinning} />
      <span className="font-medium">{phase.label}</span>
      {agent.updateTarget && <span className="font-mono opacity-70">v{agent.updateTarget}</span>}
    </div>
  );
}

/** 상세 화면용. 단계 설명과 업데이터가 마지막으로 남긴 줄까지 보여준다. */
export default function AgentUpdateStatus({
  agent,
  onAcknowledge,
}: {
  agent: Agent;
  onAcknowledge?: () => void;
}) {
  if (agent.updatePhase === 'idle') return null;
  const phase = PHASE[agent.updatePhase];
  const settled = !phase.spinning;

  return (
    <div className={`rounded-md border p-3 ${phase.tone}`}>
      <div className="flex items-center gap-2">
        <PhaseIcon phase={agent.updatePhase} spinning={phase.spinning} />
        <span className="text-xs font-semibold">{phase.label}</span>
        {agent.updateTarget && (
          <span className="text-[10px] font-mono opacity-70">
            {agent.agentVersion ? `v${agent.agentVersion} → ` : ''}v{agent.updateTarget}
          </span>
        )}
        {settled && onAcknowledge && (
          <button
            type="button"
            onClick={onAcknowledge}
            className="ml-auto text-[10px] px-2 py-0.5 rounded-sm bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
          >
            확인
          </button>
        )}
      </div>
      <p className="text-[11px] mt-1.5 opacity-80">{phase.detail}</p>
      {agent.updateMessage && (
        <p className="text-[10px] font-mono mt-2 px-2 py-1.5 rounded-sm bg-black/20 opacity-70 break-all">
          {agent.updateMessage}
        </p>
      )}
    </div>
  );
}
