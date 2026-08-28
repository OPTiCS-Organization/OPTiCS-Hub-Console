import { Loader2, CheckCircle2, AlertTriangle, Undo2, ArrowUpCircle } from "lucide-react";
import type { Agent } from "./AgentCard";
import Tooltip from "../ui/Tooltip";

export type UpdatePhase = Agent['updatePhase'];

/**
 * 업데이트는 5~10초의 다운타임을 동반하고, 그 사이 Agent는 소켓이 끊긴다.
 * 아무것도 보여주지 않으면 사용자에게는 정상 동작이 아니라 사고로 보인다.
 * 그래서 단계마다 "지금 무슨 일이 벌어지는지"와 "기다려도 되는지"를 같이 말해준다.
 */
const PHASE: Record<Exclude<UpdatePhase, 'idle'>, {
  label: string;
  /** 카드 배지에 들어가는 짧은 말. 알약 하나에 담겨야 하므로 label보다 짧다. */
  short: string;
  detail: string;
  tone: string;
  /** 카드 배지용. 테두리 없이 배경과 글자색만 쓴다. */
  pillTone: string;
  spinning: boolean;
}> = {
  requested: {
    label: '업데이트 요청됨',
    short: '요청됨',
    detail: 'Agent가 업데이트 작업을 준비하고 있습니다.',
    tone: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    pillTone: 'text-sky-400 bg-sky-500/15',
    spinning: true,
  },
  pulling: {
    label: '이미지 내려받는 중',
    short: '내려받는 중',
    detail: '교체할 버전의 Agent 이미지를 내려받는 중입니다.',
    tone: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    pillTone: 'text-sky-400 bg-sky-500/15',
    spinning: true,
  },
  restarting: {
    label: '재시작 중',
    short: '재시작 중',
    detail: 'Agent를 다시 시작하는 중입니다. 배포된 Service는 중단되지 않습니다. 이 단계에서는 Service에 다가가는 요청이 모두 거부됩니다.',
    tone: 'text-warning-color bg-warning-color/10 border-warning-color/20',
    pillTone: 'text-warning-color bg-warning-color/15',
    spinning: true,
  },
  succeeded: {
    label: '업데이트 완료',
    short: '완료',
    detail: 'Agent가 새 버전으로 정상 시작했습니다.',
    tone: 'text-success-color bg-success-color/10 border-success-color/20',
    pillTone: 'text-success-color bg-success-color/15',
    spinning: false,
  },
  rolled_back: {
    label: '되돌려짐',
    short: '되돌림',
    detail: 'Agent가 새 버전 시작에 실패하여 이전 버전으로 복구했습니다.',
    tone: 'text-caution-color bg-caution-color/10 border-caution-color/20',
    pillTone: 'text-caution-color bg-caution-color/15',
    spinning: false,
  },
  failed: {
    label: '업데이트 실패',
    short: '실패',
    detail: "Agent 호스트에서 'docker logs optics-agent-updater'로 원인을 확인하세요.",
    tone: 'text-danger-color bg-danger-color/10 border-danger-color/20',
    pillTone: 'text-danger-color bg-danger-color/15',
    spinning: false,
  },
};

/** small은 목록 카드의 알약용. 상세 화면보다 한 단계 작다. */
function PhaseIcon({ phase, spinning, small = false }: { phase: Exclude<UpdatePhase, 'idle'>; spinning: boolean; small?: boolean }) {
  const size = small ? 'w-3 h-3 shrink-0' : 'w-3.5 h-3.5 shrink-0';
  if (spinning) return <Loader2 className={`${size} animate-spin`} />;
  if (phase === 'succeeded') return <CheckCircle2 className={size} />;
  if (phase === 'rolled_back') return <Undo2 className={size} />;
  return <AlertTriangle className={size} />;
}

/**
 * Agent 목록 카드의 헤더에서 연결 배지 옆에 붙는 알약.
 *
 * 예전에는 카드 폭 전체를 쓰는 색깔 띠였다. 목록에서 필요한 것은 "업데이트가 있다"는
 * 사실과 대상 버전뿐인데, 띠가 카드마다 있다 없다 하면서 카드 높이를 흔들었고
 * 무엇보다 목록 전체에서 가장 큰 색면이 되어 정작 봐야 할 Agent 이름과 상태를 눌렀다.
 * 단계 설명은 상세 화면(AgentUpdateStatus)이 이미 온전히 맡고 있으므로,
 * 목록에서는 알약으로 줄이고 나머지 말은 툴팁으로 내렸다.
 *
 * 연결 배지와 같은 형태를 쓰는 이유는 둘 다 "이 Agent의 지금 상태"라서다.
 * 형태가 다르면 서로 다른 종류의 정보로 읽힌다.
 */
export function AgentUpdateBadge({ agent, upgradeTo }: { agent: Agent; upgradeTo?: string | null }) {
  const pillClass = 'inline-flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full text-3xs font-medium leading-none';

  if (agent.updatePhase === 'idle') {
    if (!upgradeTo) return null;
    // 원격 업데이트가 안 되는 구버전은 버튼을 눌러도 막히므로, 배지에서부터 다르게 말한다.
    const manual = !agent.remoteUpdateSupported;
    return (
      <Tooltip label={manual
        ? `수동 업데이트 필요 · ${upgradeTo} (이 빌드는 원격 업데이트를 지원하지 않습니다)`
        : `업데이트 가능 · ${upgradeTo}`}>
        <span className={`${pillClass} ${manual ? 'bg-warning-color/15 text-warning-color' : 'bg-service-color/15 text-service-color'}`}>
          <ArrowUpCircle className="w-3 h-3 shrink-0" />
          <span className="font-mono">{upgradeTo}</span>
        </span>
      </Tooltip>
    );
  }

  const phase = PHASE[agent.updatePhase];

  return (
    <Tooltip label={`${phase.label}${agent.updateTarget ? ` · ${agent.updateTarget}` : ''} — ${phase.detail}`}>
      <span className={`${pillClass} ${phase.pillTone}`}>
        <PhaseIcon phase={agent.updatePhase} spinning={phase.spinning} small />
        {phase.short}
      </span>
    </Tooltip>
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
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <PhaseIcon phase={agent.updatePhase} spinning={phase.spinning} />
        <span className="shrink-0 text-xs font-semibold">{phase.label}</span>
        {agent.updateTarget && (
          <span className="min-w-0 truncate text-3xs font-mono opacity-70">
            {agent.agentVersion ? `${agent.agentVersion} → ` : ''}{agent.updateTarget}
          </span>
        )}
        {settled && onAcknowledge && (
          <button
            type="button"
            onClick={onAcknowledge}
            className="ml-auto shrink-0 text-3xs px-2 py-0.5 rounded-sm bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
          >
            확인
          </button>
        )}
      </div>
      <p className="text-2xs mt-1.5 opacity-80">{phase.detail}</p>
      {agent.updateMessage && (
        <p className="text-3xs font-mono mt-2 px-2 py-1.5 rounded-sm bg-black/20 opacity-70 break-all">
          {agent.updateMessage}
        </p>
      )}
    </div>
  );
}
