import { useEffect, useRef, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { ArrowLeft, Terminal, GitBranch, Package, Play, Square, RefreshCw, Loader2 } from "lucide-react";
import { apiFetch } from "../lib/apiFetch";
import { useAuth } from "../context/Auth.context";
import { useModal } from "../context/Modal.context";
import { useWorkspace } from "../context/Workspace.context";

interface ServiceItem {
  serviceIndex: number;
  serviceName: string;
  servicePort: number;
  serviceSourceUrl: string;
  serviceStatus: 'waiting' | 'building' | 'running' | 'stopped' | 'failed' | 'removed';
  serviceVersion: string;
  serviceDeployPreset: 'dockerfile' | 'compose' | 'preset_nestjs';
  serviceCreatedAt: string;
  agentIndex: number;
  agentCode: string | null;
}

interface LogEntry {
  serviceIndex: number;
  log: string;
  timestamp: string;
}

const statusDot: Record<ServiceItem['serviceStatus'], string> = {
  running: 'bg-green-400',
  building: 'bg-yellow-400 animate-pulse',
  waiting: 'bg-secondary-text-color/40',
  stopped: 'bg-secondary-text-color/40',
  failed: 'bg-red-400',
  removed: 'bg-secondary-text-color/20',
};

const statusLabel: Record<ServiceItem['serviceStatus'], string> = {
  running: 'Running',
  building: 'Building',
  waiting: 'Waiting',
  stopped: 'Stopped',
  failed: 'Failed',
  removed: 'Removed',
};

const presetLabel: Record<ServiceItem['serviceDeployPreset'], string> = {
  dockerfile: 'Dockerfile',
  compose: 'Compose',
  preset_nestjs: 'NestJS',
};

const inputCls = "w-full rounded-sm bg-modal-box-color border border-border-color px-3 py-2 text-sm text-primary-text-color placeholder:text-secondary-text-color/50 outline-none focus:border-service-color transition-colors duration-100";
const labelCls = "text-xs text-secondary-text-color font-medium uppercase tracking-widest";

function RedeployForm({ service, onRedeployed }: {
  service: ServiceItem;
  onRedeployed: () => void;
}) {
  const { logout } = useAuth();
  const { closeModal } = useModal();
  const [form, setForm] = useState({
    serviceName: service.serviceName,
    servicePort: String(service.servicePort),
    serviceSourceUrl: service.serviceSourceUrl,
    serviceVersion: service.serviceVersion,
    serviceDeployPreset: service.serviceDeployPreset,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/v1/workspace/services/${service.serviceIndex}/redeploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceName: form.serviceName,
          servicePort: parseInt(form.servicePort),
          serviceSourceUrl: form.serviceSourceUrl,
          serviceVersion: form.serviceVersion,
          serviceDeployPreset: form.serviceDeployPreset,
        }),
      }, logout);
      if (!res.ok) {
        const body = await res.json() as { message?: string };
        setError(body.message ?? 'Failed.');
        return;
      }
      onRedeployed();
      closeModal();
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>서비스명</label>
        <input className={inputCls} value={form.serviceName} onChange={e => set('serviceName', e.target.value)} required />
      </div>
      <div className="flex gap-3">
        <div className="flex-1 flex flex-col gap-1.5">
          <label className={labelCls}>소스 URL</label>
          <input className={inputCls} value={form.serviceSourceUrl} onChange={e => set('serviceSourceUrl', e.target.value)} required />
        </div>
        <div className="w-28 flex flex-col gap-1.5">
          <label className={labelCls}>포트</label>
          <input className={inputCls} type="number" value={form.servicePort} onChange={e => set('servicePort', e.target.value)} required />
        </div>
      </div>
      <div className="flex gap-3">
        <div className="flex-1 flex flex-col gap-1.5">
          <label className={labelCls}>버전</label>
          <input className={inputCls} value={form.serviceVersion} onChange={e => set('serviceVersion', e.target.value)} required />
        </div>
        <div className="flex-1 flex flex-col gap-1.5">
          <label className={labelCls}>프리셋</label>
          <select className={inputCls} value={form.serviceDeployPreset} onChange={e => set('serviceDeployPreset', e.target.value)}>
            <option value="dockerfile">Dockerfile</option>
            <option value="compose">Compose</option>
            <option value="preset_nestjs">NestJS</option>
          </select>
        </div>
      </div>
      {error && (
        <div className="rounded-sm bg-red-500/10 border border-red-500/30 px-3 py-2">
          <span className="text-xs text-red-400">{error}</span>
        </div>
      )}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button type="button" onClick={closeModal} disabled={loading} className="px-4 py-1.5 rounded-sm text-sm text-secondary-text-color hover:text-primary-text-color border border-border-color hover:bg-white/5 transition-colors duration-100 cursor-pointer disabled:opacity-50">
          Cancel
        </button>
        <button type="submit" disabled={loading} className="flex items-center gap-2 px-4 py-1.5 rounded-sm text-sm font-semibold bg-service-color hover:opacity-80 text-white transition-opacity duration-100 cursor-pointer disabled:opacity-40">
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          재배포
        </button>
      </div>
    </form>
  );
}

export default function ServiceDetail() {
  const { serviceIndex } = useParams<{ serviceIndex: string }>();
  const { state } = useLocation() as { state: { service: ServiceItem } | null };
  const navigate = useNavigate();

  const [service, setService] = useState<ServiceItem | null>(state?.service ?? null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const { logout } = useAuth();
  const { openModal } = useModal();
  const { currentWorkspace } = useWorkspace();

  useEffect(() => {
    if (!service || !serviceIndex) return;

    const socket: Socket = io(`${import.meta.env.VITE_API_URL}/console`, {
      transports: ['websocket'],
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('subscribe-log', {
        agentCode: service.agentCode,
        serviceIndex: Number(serviceIndex),
        serviceName: service.serviceName,
      });
    });

    socket.on('service-log', (data: LogEntry) => {
      if (data.serviceIndex !== Number(serviceIndex)) return;
      setLogs(prev => [...prev, data].slice(-1000));
    });

    socket.on('service-status', (data: { serviceIndex: number; status: ServiceItem['serviceStatus'] }) => {
      if (data.serviceIndex !== Number(serviceIndex)) return;
      if (data.status === 'stopped' || data.status === 'restarting' as ServiceItem['serviceStatus']) setLogs([]);
      setService(prev => prev ? { ...prev, serviceStatus: data.status } : prev);
    });

    return () => {
      socket.emit('unsubscribe-log', {
        agentCode: service.agentCode,
        serviceName: service.serviceName,
      });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [service, serviceIndex]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (!service) {
    return (
      <div className="text-primary-text-color mt-20 flex flex-col items-center gap-3">
        <p className="text-secondary-text-color text-sm">서비스 정보를 찾을 수 없습니다.</p>
        <button onClick={() => navigate('/services')} className="flex items-center gap-1.5 text-xs text-secondary-text-color hover:text-primary-text-color transition-colors cursor-pointer">
          <ArrowLeft className="w-3 h-3" />
          목록으로
        </button>
      </div>
    );
  }

  async function handleStartService() {
    try {
      const res = await apiFetch(`/v1/workspace/services/${serviceIndex}/start`, {
        method: 'POST',
      }, logout);
      if (!res.ok) {
        const body = await res.json() as { message?: string };
        console.log(body);
      }
    } catch (error) {
      console.log(error);
    }
  }

  async function handleStopService() {
    try {
      const res = await apiFetch(`/v1/workspace/services/${serviceIndex}/stop`, {
        method: 'POST',
      }, logout);
      if (!res.ok) {
        const body = await res.json() as { message?: string };
        console.log(body);
      }
    } catch (error) {
      console.log(error);
    }
  }

  return (
    <div className="text-primary-text-color mt-20">

      {/* 헤더 */}
      <button
        onClick={() => navigate('/services')}
        className="flex items-center gap-1.5 text-xs text-secondary-text-color hover:text-primary-text-color transition-colors cursor-pointer mb-6"
      >
        <ArrowLeft className="w-3 h-3" />
        목록으로
      </button>

      <div className="flex items-start gap-4 mb-6">
        <div className="relative w-10 h-10 rounded-md bg-modal-box-color border border-border-color flex items-center justify-center shrink-0">
          <Package className="w-5 h-5 text-secondary-text-color" />
          <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-background-color ${statusDot[service.serviceStatus]}`} />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-lg font-bold">{service.serviceName}</h1>
            <span className="text-secondary-text-color/60 text-xs">{presetLabel[service.serviceDeployPreset]}</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className={service.serviceStatus === 'running' ? 'text-green-400' : service.serviceStatus === 'failed' ? 'text-red-400' : 'text-secondary-text-color'}>
              {statusLabel[service.serviceStatus]}
            </span>
            <span className="text-secondary-text-color/40">·</span>
            <span className="text-secondary-text-color">v{service.serviceVersion}</span>
            <span className="text-secondary-text-color/40">·</span>
            <span className="text-secondary-text-color">:{service.servicePort}</span>
            {service.agentCode && (
              <>
                <span className="text-secondary-text-color/40">·</span>
                <span className="font-mono text-secondary-text-color/70">{service.agentCode}</span>
              </>
            )}
          </div>
          {service.serviceSourceUrl && (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-secondary-text-color/60">
              <GitBranch className="w-3 h-3 shrink-0" />
              <span className="font-mono truncate">{service.serviceSourceUrl}</span>
            </div>
          )}
          <div className="mt-1 flex items-center gap-3">
            <Play className="w-4 h-4 cursor-pointer text-secondary-text-color hover:text-primary-text-color transition-colors" onClick={() => handleStartService()} />
            <Square className="w-4 h-4 cursor-pointer text-secondary-text-color hover:text-red-400 transition-colors" onClick={() => handleStopService()} />
            <RefreshCw
              className="w-4 h-4 cursor-pointer text-secondary-text-color hover:text-primary-text-color transition-colors"
              onClick={() => {
                if (!service || !currentWorkspace) return;
                openModal('재배포', <RedeployForm service={service} onRedeployed={() => {}} />);
              }}
            />
          </div>
        </div>
      </div>

      {/* 로그 패널 */}
      <div className="border border-border-color rounded-md bg-modal-box-color flex flex-col" style={{ height: 'calc(100vh - 320px)', minHeight: '300px' }}>
        <div className="px-4 py-2.5 border-b border-border-color flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-secondary-text-color" />
            <span className="text-xs font-semibold text-primary-text-color">로그</span>
            <span className="w-1.5 h-1.5 rounded-full bg-service-color animate-pulse" />
          </div>
          <button
            onClick={() => setLogs([])}
            className="text-[10px] text-secondary-text-color hover:text-primary-text-color transition-colors cursor-pointer"
          >
            지우기
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-5">
          {logs.length === 0
            ? <span className="text-secondary-text-color/40">로그 대기 중...</span>
            : logs.map((entry, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-secondary-text-color/40 shrink-0">
                  {new Date(entry.timestamp).toLocaleTimeString('ko-KR')}
                </span>
                <span className={entry.log.startsWith('ERROR') ? 'text-red-400' : 'text-primary-text-color'}>
                  {entry.log}
                </span>
              </div>
            ))
          }
          <div ref={logEndRef} />
        </div>
      </div>

    </div>
  );
}
