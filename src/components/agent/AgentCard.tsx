import { ServerCog } from "lucide-react";

export interface Agent {
  agentIndex: number;
  agentIp: string | null;
  agentCode: string;
  agentConnection: 'unlinked' | 'requested' | 'linked';
  agentStatus: 'waiting' | 'online' | 'offline' | 'restarting' | 'failed';
  agentCreatedAt: string;
  agentLastOnline: string;
  workspaceName: string | null;
}

const statusDot: Record<Agent['agentStatus'], string> = {
  online: 'bg-green-400',
  offline: 'bg-secondary-text-color/40',
  waiting: 'bg-yellow-400',
  restarting: 'bg-yellow-400',
  failed: 'bg-red-400',
};

const connectionBadge: Record<Agent['agentConnection'], string> = {
  linked: 'bg-service-color/15 text-service-color',
  requested: 'bg-yellow-500/15 text-yellow-400',
  unlinked: 'bg-white/5 text-secondary-text-color',
};

const connectionLabel: Record<Agent['agentConnection'], string> = {
  linked: 'Linked',
  requested: 'Requested',
  unlinked: 'Unlinked',
};

function formatRelative(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}초 전`;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

export default function AgentCard({ agent }: { agent: Agent }) {
  return (
    <div className="border border-border-color rounded-md bg-modal-box-color overflow-hidden">
      <div className="px-4 py-4 flex items-start gap-3">
        <div className="relative w-9 h-9 rounded-md bg-white/5 flex items-center justify-center shrink-0">
          <ServerCog className="w-4.5 h-4.5 text-secondary-text-color" />
          <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-modal-box-color ${statusDot[agent.agentStatus]}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-primary-text-color font-semibold text-sm font-mono truncate">
              {agent.agentCode}
            </span>
            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${connectionBadge[agent.agentConnection]}`}>
              {connectionLabel[agent.agentConnection]}
            </span>
          </div>
          <p className="text-secondary-text-color text-xs font-mono">
            {agent.agentIp ?? <span className="text-secondary-text-color/40">IP 비공개</span>}
          </p>
        </div>
      </div>
      <div className="px-4 py-2.5 border-t border-border-color flex items-center justify-between">
        <span className="text-secondary-text-color/60 text-[10px]">
          {agent.agentStatus === 'online' ? '현재 온라인' : `마지막 온라인 ${formatRelative(agent.agentLastOnline)}`}
        </span>
        <span className="text-secondary-text-color/60 text-[10px]">
          등록 {formatRelative(agent.agentCreatedAt)}
        </span>
      </div>
    </div>
  );
}
