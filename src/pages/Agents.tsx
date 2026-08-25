import { useState, useEffect, useCallback } from "react";
import { Loader2, Send, RefreshCw } from "lucide-react";
import { io } from "socket.io-client";
import { useWorkspace } from "../context/Workspace.context";
import { useAuth } from "../context/Auth.context";
import { apiFetch } from "../lib/apiFetch";
import AgentCard, { type Agent } from "../components/agent/AgentCard";
import AgentDisconnectConfirm from "../components/agent/AgentDisconnectConfirm";
import { useModal } from "../context/Modal.context";
import { useNavigate } from "react-router-dom";

export default function Agents() {
  const navigate = useNavigate();
  const { currentWorkspace, refresh } = useWorkspace();
  const { logout } = useAuth();
  const { openModal, closeModal } = useModal();
  const [agentCode, setAgentCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);

  // silent: 소켓 이벤트로 인한 재조회. 목록 전체를 로딩 상태로 되돌리지 않는다.
  const fetchAgents = useCallback(async (options?: { silent?: boolean }) => {
    if (!currentWorkspace) return;
    if (!options?.silent) setAgentsLoading(true);
    try {
      const res = await apiFetch(`/v1/agent/workspace/${currentWorkspace.workspaceIndex}`, {}, logout);
      const body = await res.json() as { data: { agents: Agent[] } };
      setAgents(body.data.agents);
    } catch {
      // ignore
    } finally {
      if (!options?.silent) setAgentsLoading(false);
    }
  }, [logout, currentWorkspace]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    if (!currentWorkspace) return;
    const socket = io(`${import.meta.env.VITE_API_URL}/console`, {
      transports: ['websocket'],
      reconnection: true,
      withCredentials: true,
    });
    socket.on('connect', () => {
      socket.emit('subscribe-workspace', { workspaceIndex: currentWorkspace.workspaceIndex });
    });
    socket.on('agent-updated', () => void fetchAgents({ silent: true }));
    // 업데이트 단계 전이는 별도 이벤트로 온다. 진행 중에도 카드가 실시간으로 따라가야 한다.
    socket.on('agent-update', () => void fetchAgents({ silent: true }));
    return () => { socket.disconnect(); };
  }, [currentWorkspace, fetchAgents]);

  async function handleConnect(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!currentWorkspace || !agentCode.trim()) return;

    setIsLoading(true);
    setMessage(null);
    try {
      const res = await apiFetch(`/v1/workspace/${currentWorkspace.workspaceIndex}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetAgentCode: agentCode.trim() }),
      }, logout);

      const body = await res.json() as { message?: string };
      setMessage({ text: body.message ?? (res.ok ? 'Request sent.' : 'Failed.'), ok: res.ok });
      if (res.ok) {
        setAgentCode('');
        await refresh();
        await fetchAgents();
      }
    } catch {
      setMessage({ text: 'Network error.', ok: false });
    } finally {
      setIsLoading(false);
    }
  }

  // 되돌릴 수 없는 동작이라 카드에서 곧바로 실행하지 않고 확인을 한 번 받는다.
  function handleDisconnectAgent(agent: Agent) {
    openModal('에이전트 연결 해제 확인', (
      <AgentDisconnectConfirm
        agentName={agent.agentName}
        agentCode={agent.agentCode}
        onConfirm={() => disconnectAgent(agent)}
        onCancel={() => closeModal()}
      />
    ));
  }

  async function disconnectAgent(agent: Agent) {
    if (!currentWorkspace) return;
    try {
      const res = await apiFetch(`/v1/workspace/${currentWorkspace.workspaceIndex}/agent/${encodeURIComponent(agent.agentCode)}/disconnect`, {
        method: 'DELETE',
      }, logout);
      if (!res.ok) {
        const body = await res.json() as { message?: string };
        setMessage({ text: body.message ?? 'Failed.', ok: false });
        return;
      }
      closeModal({ force: true });
    } catch {
      setMessage({ text: 'Network error.', ok: false });
    }
  }

  async function handleCancelAgent(agent: Agent) {
    if (!currentWorkspace) return;
    try {
      const res = await apiFetch(`/v1/workspace/${currentWorkspace.workspaceIndex}/agent/${encodeURIComponent(agent.agentCode)}/cancel`, {
        method: 'DELETE',
      }, logout);
      if (!res.ok) {
        const body = await res.json() as { message?: string };
        setMessage({ text: body.message ?? 'Failed.', ok: false });
      }
    } catch {
      setMessage({ text: 'Network error.', ok: false });
    }
  }

  return (
    <div className="text-primary-text-color mt-16">
      <h1 className="text-lg font-bold mb-1">Agents</h1>
      <p className="text-secondary-text-color text-sm mb-6">
        에이전트 연결 코드를 입력해 현재 워크스페이스에 연결 요청을 보내세요.
      </p>

      {!currentWorkspace ? (
        <p className="text-secondary-text-color text-sm mb-8">워크스페이스를 먼저 선택해주세요.</p>
      ) : (
        <div className="max-w-lg mb-10">
          <form onSubmit={handleConnect} className="flex gap-2">
            <input
              type="text"
              value={agentCode}
              onChange={e => setAgentCode(e.target.value.toUpperCase())}
              placeholder="word-word"
              className="flex-1 px-3 py-2 rounded-sm border border-border-color bg-modal-box-color text-primary-text-color text-sm placeholder:text-secondary-text-color/50 outline-none focus:border-service-color transition-colors"
            />
            <button
              type="submit"
              disabled={isLoading || !agentCode.trim()}
              className="shrink-0 px-3 py-2 rounded-sm bg-service-color text-white text-sm font-semibold hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
            >
              {isLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />
              }
              연결 요청
            </button>
          </form>

          {message && (
            <p className={`mt-3 text-xs ${message.ok ? 'text-service-color' : 'text-danger-color'}`}>
              {message.text}
            </p>
          )}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-primary-text-color">
            에이전트 목록
            {agents.length > 0 && (
              <span className="ml-2 text-secondary-text-color font-normal">{agents.length}</span>
            )}
          </h2>
          <button
            onClick={() => void fetchAgents()}
            disabled={agentsLoading}
            className="flex items-center gap-1.5 text-xs text-secondary-text-color hover:text-primary-text-color transition-colors disabled:opacity-40 cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${agentsLoading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>

        {agentsLoading && agents.length === 0 ? (
          <div className="flex items-center gap-2 text-secondary-text-color text-sm py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            불러오는 중...
          </div>
        ) : agents.length === 0 ? (
          <p className="text-secondary-text-color text-sm py-8 text-center">연결된 에이전트가 없습니다.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {agents.map(agent => (
              <AgentCard
                key={agent.agentIndex}
                agent={agent}
                upgradeTo={agent.upgrade?.version ?? null}
                onOpen={selected => navigate(`/agents/${selected.agentUuid}`)}
                onDisconnect={handleDisconnectAgent}
                onCancel={handleCancelAgent}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
