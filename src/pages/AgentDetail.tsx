import { ArrowLeft, Cpu, Loader2, MemoryStick, RefreshCw, TerminalSquare, Unlink } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import {
  type Agent,
  connectionBadge,
  connectionLabel,
  formatAgentVersion,
  formatRelative,
  statusDot,
  statusLabel,
} from '../components/agent/AgentCard';
import SshTerminal from '../components/agent/SshTerminal';
import TerminalAuthModal from '../components/agent/TerminalAuthModal';
import { useAuth } from '../context/Auth.context';
import { useModal } from '../context/Modal.context';
import { useWorkspace } from '../context/Workspace.context';
import { apiFetch } from '../lib/apiFetch';
import Tooltip from '../components/ui/Tooltip';

type TabKey = 'overview' | 'terminal';

type AgentMetrics = {
  timestamp: number;
  cpu: { usage: number };
  memory: { used: number; total: number; usage: number };
};

function percent(value: number) {
  return `${Math.max(0, value * 100).toFixed(1)}%`;
}

function memory(value: number) {
  return value >= 1024 ? `${(value / 1024).toFixed(1)} GiB` : `${value.toFixed(0)} MiB`;
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-2.5 border-b border-border-color/40 last:border-0">
      <span className="w-24 shrink-0 text-xs text-secondary-text-color/70">{label}</span>
      <div className="min-w-0 flex-1 text-xs text-primary-text-color">{children}</div>
    </div>
  );
}

function RadialGauge({ value, size = 56, strokeWidth = 5 }: { value: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, value));
  const offset = circumference * (1 - clamped);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke="var(--color-background-color)" strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke="var(--color-service-color)" strokeWidth={strokeWidth} strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        className="transition-[stroke-dashoffset] duration-500 ease-out"
      />
    </svg>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const width = 100;
  const height = 26;
  if (data.length < 2) {
    return <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} />;
  }
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - Math.min(1, Math.max(0, value)) * height;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-service-color)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
    </svg>
  );
}

function MetricCard({
  title,
  value,
  detail,
  usage,
  history,
  icon,
}: {
  title: string;
  value: string;
  detail: string;
  usage: number;
  history: number[];
  icon: ReactNode;
}) {
  return (
    <div className="rounded-md border border-border-color bg-modal-box-color p-4">
      <div className="flex items-center gap-3.5">
        <div className="relative shrink-0">
          <RadialGauge value={usage} />
          <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-primary-text-color">
            {Math.round(Math.min(1, Math.max(0, usage)) * 100)}%
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-secondary-text-color">{title}</span>
            <span className="shrink-0 text-service-color">{icon}</span>
          </div>
          <p className="mt-0.5 truncate text-lg font-semibold text-primary-text-color">{value}</p>
          <p className="truncate text-[11px] text-secondary-text-color">{detail}</p>
        </div>
      </div>
      <div className="mt-3 border-t border-border-color/40 pt-2">
        <Sparkline data={history} />
      </div>
    </div>
  );
}

export default function AgentDetail() {
  const { agentUuid = '' } = useParams();
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const { logout } = useAuth();
  const { openModal, closeModal } = useModal();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [metrics, setMetrics] = useState<AgentMetrics | null>(null);
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [memHistory, setMemHistory] = useState<number[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [terminalToken, setTerminalToken] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const loadAgent = useCallback(async () => {
    if (!currentWorkspace) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await apiFetch(
        `/v1/agent/workspace/${currentWorkspace.workspaceIndex}`,
        {},
        logout,
      );
      const body = await response.json().catch(() => ({})) as { data?: { agents?: Agent[] } };
      setAgent(body.data?.agents?.find(item => item.agentUuid === agentUuid) ?? null);
    } finally {
      setLoading(false);
    }
  }, [agentUuid, currentWorkspace, logout]);

  useEffect(() => {
    void loadAgent();
  }, [loadAgent]);

  useEffect(() => {
    if (!currentWorkspace || !agentUuid) return;
    const connection = io(`${import.meta.env.VITE_API_URL}/console`, {
      transports: ['websocket'],
      reconnection: true,
      withCredentials: true,
    });
    setSocket(connection);
    setCpuHistory([]);
    setMemHistory([]);

    const requestMetrics = () => connection.emit('agent-metrics-request', { agentUuid });
    connection.on('connect', () => {
      connection.emit('subscribe-workspace', { workspaceIndex: currentWorkspace.workspaceIndex });
      requestMetrics();
    });
    connection.on('agent-metrics', (payload: { agentUuid: string; metrics: AgentMetrics }) => {
      if (payload.agentUuid !== agentUuid) return;
      setMetrics(payload.metrics);
      setCpuHistory(prev => [...prev, payload.metrics.cpu.usage].slice(-30));
      setMemHistory(prev => [...prev, payload.metrics.memory.usage].slice(-30));
    });
    connection.on('agent-updated', () => { void loadAgent(); });
    const timer = window.setInterval(requestMetrics, 2000);

    return () => {
      window.clearInterval(timer);
      connection.disconnect();
      setSocket(null);
    };
  }, [agentUuid, currentWorkspace, loadAgent]);

  function requestTerminalAccess() {
    if (!agent) return;
    openModal('SSH 터미널 인증', (
      <TerminalAuthModal
        agentUuid={agent.agentUuid}
        onAuthorized={setTerminalToken}
      />
    ));
  }

  async function disconnectAgent() {
    if (!agent || !currentWorkspace) return;
    setDisconnecting(true);
    try {
      const res = await apiFetch(
        `/v1/workspace/${currentWorkspace.workspaceIndex}/agent/${encodeURIComponent(agent.agentCode)}/disconnect`,
        { method: 'DELETE' },
        logout,
      );
      if (res.ok) {
        closeModal({ force: true });
        navigate('/agents');
      }
    } finally {
      setDisconnecting(false);
    }
  }

  function handleDisconnect() {
    if (!agent) return;
    openModal('연결 해제', (
      <div className="space-y-4">
        <p className="text-xs text-secondary-text-color">
          '{agent.agentName}' 연결을 해제하시겠습니까? 이 Agent를 통해 배포된 서비스는 계속 실행되지만, 이 워크스페이스에서 더 이상 제어할 수 없습니다.
        </p>
        <div className="flex justify-end gap-2 border-t border-border-color pt-3">
          <button
            type="button"
            onClick={() => closeModal()}
            disabled={disconnecting}
            className="h-8 rounded-sm border border-border-color px-3 text-xs text-secondary-text-color transition-colors hover:bg-white/5 hover:text-primary-text-color cursor-pointer disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => { void disconnectAgent(); }}
            disabled={disconnecting}
            className="inline-flex h-8 items-center gap-2 rounded-sm bg-red-500/90 px-3.5 text-xs font-semibold text-white transition-opacity hover:opacity-80 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
          >
            {disconnecting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            연결 해제
          </button>
        </div>
      </div>
    ));
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-secondary-text-color">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!currentWorkspace || !agent) {
    return (
      <div className="mt-20 text-primary-text-color">
        <Link to="/agents" className="flex items-center gap-1 text-sm text-secondary-text-color hover:text-primary-text-color">
          <ArrowLeft className="h-4 w-4" /> Agents
        </Link>
        <p className="mt-8 text-sm text-secondary-text-color">Agent를 찾을 수 없거나 접근 권한이 없습니다.</p>
      </div>
    );
  }

  const terminalAvailable = agent.agentConnection === 'linked' && agent.agentStatus === 'online';

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: '개요' },
    { key: 'terminal', label: '터미널' },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden pt-20 text-primary-text-color">

      {/* 뒤로가기 */}
      <Link
        to="/agents"
        className="mb-4 flex w-fit shrink-0 items-center gap-1.5 text-xs text-secondary-text-color hover:text-primary-text-color transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-3 h-3" />
        목록으로
      </Link>

      {/* 헤더: 정체성 + 제어 */}
      <div className="mb-4 flex shrink-0 items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <div className="relative w-10 h-10 rounded-md bg-modal-box-color border border-border-color flex items-center justify-center shrink-0">
            <Cpu className="w-5 h-5 text-secondary-text-color" />
            <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-background-color ${statusDot[agent.agentStatus]}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-lg font-bold truncate">{agent.agentName}</h1>
              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${connectionBadge[agent.agentConnection]}`}>
                {connectionLabel[agent.agentConnection]}
              </span>
            </div>
            <span className={`text-xs ${agent.agentStatus === 'online' ? 'text-green-400' : agent.agentStatus === 'failed' ? 'text-red-400' : agent.agentStatus === 'restarting' || agent.agentStatus === 'waiting' ? 'text-yellow-400' : 'text-secondary-text-color'}`}>
              {statusLabel[agent.agentStatus]}
              {agent.agentStatus !== 'online' && (
                <span className="text-secondary-text-color/60 ml-1">
                  마지막 온라인 {formatRelative(agent.agentLastOnline)}
                </span>
              )}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Tooltip label="새로고침" side="bottom">
            <button
              type="button"
              onClick={() => { void loadAgent(); }}
              className="p-1 text-secondary-text-color hover:text-primary-text-color transition-colors cursor-pointer"
              aria-label="새로고침"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </Tooltip>
          {agent.agentConnection === 'linked' && (
            <Tooltip label="에이전트와의 연결을 해제합니다" side="bottom">
              <button
                type="button"
                onClick={handleDisconnect}
                className="p-1 text-secondary-text-color hover:text-red-400 transition-colors cursor-pointer"
                aria-label="연결 해제"
              >
                <Unlink className="w-4 h-4" />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* 탭 바 */}
      <div className="mb-3 flex shrink-0 items-center gap-1 border-b border-border-color">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
              activeTab === tab.key
                ? 'border-service-color text-primary-text-color'
                : 'border-transparent text-secondary-text-color hover:text-primary-text-color'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">

        {activeTab === 'overview' && (
          <div className="overflow-y-auto pr-1">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-4">
              <MetricCard
                title="CPU 사용률"
                value={metrics ? percent(metrics.cpu.usage) : '--'}
                detail={metrics ? `측정 ${new Date(metrics.timestamp).toLocaleTimeString()}` : 'Agent 응답 대기 중'}
                usage={metrics?.cpu.usage ?? 0}
                history={cpuHistory}
                icon={<Cpu className="h-4 w-4" />}
              />
              <MetricCard
                title="메모리 사용량"
                value={metrics ? memory(metrics.memory.used) : '--'}
                detail={metrics ? `${memory(metrics.memory.total)} 중 ${percent(metrics.memory.usage)}` : 'Agent 응답 대기 중'}
                usage={metrics?.memory.usage ?? 0}
                history={memHistory}
                icon={<MemoryStick className="h-4 w-4" />}
              />
            </div>

            <InfoRow label="에이전트 코드">
              <span className="font-mono">{agent.agentCode}</span>
            </InfoRow>
            <InfoRow label="버전">
              <span className="font-mono">{formatAgentVersion(agent.agentVersion)}</span>
            </InfoRow>
            <InfoRow label="IP">
              <span className="font-mono">
                {agent.agentIp ?? <span className="text-secondary-text-color/50">비공개</span>}
              </span>
            </InfoRow>
            <InfoRow label="워크스페이스">
              {agent.workspaceName ?? <span className="text-secondary-text-color/50">미연결</span>}
            </InfoRow>
            <InfoRow label="UUID">
              <span className="font-mono text-secondary-text-color/80">{agent.agentUuid}</span>
            </InfoRow>
            <InfoRow label="등록일">
              <span className="text-secondary-text-color/80">{new Date(agent.agentCreatedAt).toLocaleString()}</span>
            </InfoRow>
            <InfoRow label="마지막 온라인">
              <span className="text-secondary-text-color/80">
                {agent.agentStatus === 'online' ? '현재 온라인' : formatRelative(agent.agentLastOnline)}
              </span>
            </InfoRow>
          </div>
        )}

        {activeTab === 'terminal' && (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {terminalToken && socket ? (
              <SshTerminal
                socket={socket}
                token={terminalToken}
                onClose={() => setTerminalToken(null)}
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border-color py-16 text-center">
                <TerminalSquare className="h-6 w-6 text-secondary-text-color" />
                <p className="text-xs text-secondary-text-color">
                  {terminalAvailable
                    ? 'TOTP 인증 후 이 Agent의 호스트 셸에 접속할 수 있습니다.'
                    : 'Agent가 온라인 상태로 연결되어 있어야 터미널을 열 수 있습니다.'}
                </p>
                <button
                  type="button"
                  onClick={requestTerminalAccess}
                  disabled={!terminalAvailable || !socket}
                  className="flex cursor-pointer items-center gap-2 rounded-sm bg-service-color px-3 py-2 text-sm font-semibold text-white hover:bg-button-progress-color disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <TerminalSquare className="h-4 w-4" /> 터미널 접속
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
