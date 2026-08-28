import { ServerCog } from "lucide-react";
import Tooltip from "../ui/Tooltip";
import { AgentUpdateBadge } from "./AgentUpdateStatus";
import { dangerSoftButtonClass } from "../../constants/danger";

export interface Agent {
  agentIndex: number;
  agentIp: string | null;
  agentCode: string;
  agentName: string;
  agentUuid: string;
  agentConnection: 'unlinked' | 'requested' | 'linked';
  agentStatus: 'waiting' | 'online' | 'offline' | 'restarting' | 'failed';
  agentCreatedAt: string;
  agentLastOnline: string;
  workspaceName: string | null;
  agentVersion: string | null;
  updatePhase: 'idle' | 'requested' | 'pulling' | 'restarting' | 'succeeded' | 'rolled_back' | 'failed';
  updateTarget: string | null;
  updateMessage: string | null;
  updateStartedAt: string | null;
  /** 올라갈 수 있는 릴리즈. 판정은 Hub가 한다 (SemVer 비교 + 프로토콜 지원 범위). */
  upgrade: { version: string; notes: string | null } | null;
  /** 원격 업데이트(update-agent)를 처리할 수 있는 빌드인지. 0.6.0 미만은 false. */
  remoteUpdateSupported: boolean;
}

/** 버전을 보고하지 않는 Agent는 버전 필드가 도입되기 전(0.5.0 미만) 빌드다. */
export function formatAgentVersion(version: string | null) {
  return version ?? '< 0.5.0';
}

export const statusDot: Record<Agent['agentStatus'], string> = {
  online: 'bg-success-color',
  offline: 'bg-secondary-text-color/40',
  waiting: 'bg-warning-color',
  restarting: 'bg-warning-color',
  failed: 'bg-danger-color',
};

export const statusLabel: Record<Agent['agentStatus'], string> = {
  online: '온라인',
  offline: '오프라인',
  waiting: '대기 중',
  restarting: '재시작 중',
  failed: '실패',
};

export const connectionBadge: Record<Agent['agentConnection'], string> = {
  linked: 'bg-service-color/15 text-service-color',
  requested: 'bg-warning-color/15 text-warning-color',
  unlinked: 'bg-white/5 text-secondary-text-color',
};

export const connectionLabel: Record<Agent['agentConnection'], string> = {
  linked: 'Linked',
  requested: 'Requested',
  unlinked: 'Unlinked',
};

export function formatRelative(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}초 전`;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

interface AgentCardProps {
  agent: Agent;
  /** 이 Agent가 올릴 수 있는 최신 버전. 없으면 배지를 띄우지 않는다. */
  upgradeTo?: string | null;
  onOpen?: (agent: Agent) => void;
  onDisconnect?: (agent: Agent) => void;
  onCancel?: (agent: Agent) => void;
}

export default function AgentCard({ agent, upgradeTo, onOpen, onDisconnect, onCancel }: AgentCardProps) {
  return (
    <div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={() => onOpen?.(agent)}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') onOpen?.(agent);
      }}
      className={`border border-border-color rounded-md bg-modal-box-color overflow-hidden transition-colors ${onOpen ? 'cursor-pointer hover:border-border-strong-color' : ''}`}
    >
      <div className="px-4 py-4 flex items-start gap-3">
        <div className="relative w-9 h-9 rounded-md bg-white/5 flex items-center justify-center shrink-0">
          <ServerCog className="w-4.5 h-4.5 text-secondary-text-color" />
          <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-modal-box-color ${statusDot[agent.agentStatus]}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-primary-text-color font-semibold text-sm truncate">
              {agent.agentName}
            </span>
            <span className={`inline-block px-2 py-0.5 rounded-full text-3xs font-medium leading-none shrink-0 ${connectionBadge[agent.agentConnection]}`}>
              {connectionLabel[agent.agentConnection]}
            </span>
            <AgentUpdateBadge agent={agent} upgradeTo={upgradeTo} />
          </div>
          <p className="text-secondary-text-color text-xs font-mono">
            {agent.agentCode}
          </p>
          <p className="text-secondary-text-color/60 text-xs font-mono mt-0.5">
            {agent.agentIp ?? <span className="text-secondary-text-color/40">IP 비공개</span>}
          </p>
        </div>
      </div>
      <div className="px-4 py-2.5 border-t border-border-color flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-secondary-text-color/60 text-3xs font-mono">
          {formatAgentVersion(agent.agentVersion)}
          <span className="mx-1.5 opacity-50">·</span>
          {agent.agentStatus === 'online' ? '현재 온라인' : `마지막 온라인 ${formatRelative(agent.agentLastOnline)}`}
        </span>
        {agent.agentConnection === 'linked' ? (
          <Tooltip label="에이전트와의 연결을 해제합니다">
            <button
              type="button"
              onClick={event => { event.stopPropagation(); onDisconnect?.(agent); }}
              className={`${dangerSoftButtonClass} shrink-0 text-3xs px-2 py-1`}
              aria-label="연결 해제"
            >
              연결 해제
            </button>
          </Tooltip>
        ) : agent.agentConnection === 'requested' ? (
          <Tooltip label="연결 요청을 취소합니다">
            <button
              type="button"
              onClick={event => { event.stopPropagation(); onCancel?.(agent); }}
              className="shrink-0 text-3xs px-2 py-1 rounded-sm bg-warning-color/10 text-warning-color hover:bg-warning-color/20 transition-colors cursor-pointer"
              aria-label="요청 취소"
            >
              요청 취소
            </button>
          </Tooltip>
        ) : (
          <span className="shrink-0 text-secondary-text-color/60 text-3xs">
            등록 {formatRelative(agent.agentCreatedAt)}
          </span>
        )}
      </div>
    </div>
  );
}
