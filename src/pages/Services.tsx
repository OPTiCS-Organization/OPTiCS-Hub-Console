import { useState, useEffect, useCallback } from "react";
import { Loader2, RefreshCw, GitBranch, Package, Plus } from "lucide-react";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";

import { useWorkspace } from "../context/Workspace.context";
import { useAuth } from "../context/Auth.context";
import { useModal } from "../context/Modal.context";
import { apiFetch } from "../lib/apiFetch";

/* ─── Types ─────────────────────────────────────────────── */

interface AgentOption {
  agentIndex: number;
  agentCode: string;
}

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

interface EnvEntry {
  key: string;
  value: string;
}

interface ServiceFormState {
  serviceName: string;
  servicePort: string;
  serviceSourceUrl: string;
  serviceVersion: string;
  serviceDeployPreset: string;
  agentIndex: string;
}

/* ─── Constants ──────────────────────────────────────────── */

const inputCls = "w-full rounded-sm bg-modal-box-color border border-border-color px-3 py-2 text-sm text-primary-text-color placeholder:text-secondary-text-color/50 outline-none focus:border-service-color transition-colors duration-100";
const labelCls = "text-xs text-secondary-text-color font-medium uppercase tracking-widest";

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

/* ─── CreateServiceForm ──────────────────────────────────── */

function CreateServiceForm({ workspaceIdx, onCreated }: {
  workspaceIdx: number;
  onCreated: () => void;
}) {
  const { logout } = useAuth();
  const { closeModal } = useModal();
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [form, setForm] = useState<ServiceFormState>({
    serviceName: '',
    servicePort: '',
    serviceSourceUrl: '',
    serviceVersion: '1.0.0',
    serviceDeployPreset: 'dockerfile',
    agentIndex: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [envEntries, setEnvEntries] = useState<EnvEntry[]>([]);

  useEffect(() => {
    apiFetch(`/v1/agent/workspace/${workspaceIdx}`, {}, logout)
      .then(r => r.json())
      .then((body: { data: { agents: { agentIndex: number; agentCode: string; agentConnection: string }[] } }) => {
        const linked = body.data.agents.filter(a => a.agentConnection === 'linked');
        setAgents(linked);
        if (linked.length > 0) setForm(f => ({ ...f, agentIndex: String(linked[0].agentIndex) }));
      })
      .catch(() => { });
  }, [workspaceIdx, logout]);

  function set(key: keyof ServiceFormState, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function addEnvEntry() {
    setEnvEntries(prev => [...prev, { key: '', value: '' }]);
  }

  function updateEnvEntry(index: number, field: 'key' | 'value', val: string) {
    setEnvEntries(prev => prev.map((e, i) => i === index ? { ...e, [field]: val } : e));
  }

  function removeEnvEntry(index: number) {
    setEnvEntries(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const env = Object.fromEntries(envEntries.filter(e => e.key.trim()).map(e => [e.key, e.value]));
    try {
      const res = await apiFetch(`/v1/workspace/services/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceIdx: workspaceIdx,
          serviceName: form.serviceName,
          servicePort: parseInt(form.servicePort),
          serviceSourceUrl: form.serviceSourceUrl,
          serviceVersion: form.serviceVersion,
          serviceDeployPreset: form.serviceDeployPreset,
          agentIndex: parseInt(form.agentIndex),
          env,
        }),
      }, logout);
      if (!res.ok) {
        const body = await res.json() as { message?: string };
        setError(body.message ?? 'Failed.');
        return;
      }
      onCreated();
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
        <label className={labelCls}>서비스명 <span className="text-service-color">*</span></label>
        <input className={inputCls} placeholder="my-service" value={form.serviceName} onChange={e => set('serviceName', e.target.value)} autoFocus required />
      </div>

      <div className="flex gap-3">
        <div className="flex-1 flex flex-col gap-1.5">
          <label className={labelCls}>소스 URL <span className="text-service-color">*</span></label>
          <input className={inputCls} placeholder="https://github.com/..." value={form.serviceSourceUrl} onChange={e => set('serviceSourceUrl', e.target.value)} required />
        </div>
        <div className="w-28 flex flex-col gap-1.5">
          <label className={labelCls}>포트 <span className="text-service-color">*</span></label>
          <input className={inputCls} placeholder="3000" type="number" value={form.servicePort} onChange={e => set('servicePort', e.target.value)} required />
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 flex flex-col gap-1.5">
          <label className={labelCls}>버전 <span className="text-service-color">*</span></label>
          <input className={inputCls} placeholder="1.0.0" value={form.serviceVersion} onChange={e => set('serviceVersion', e.target.value)} required />
        </div>
        <div className="flex-1 flex flex-col gap-1.5">
          <label className={labelCls}>프리셋 <span className="text-service-color">*</span></label>
          <select className={inputCls} value={form.serviceDeployPreset} onChange={e => set('serviceDeployPreset', e.target.value)}>
            <option value="dockerfile">Dockerfile</option>
            <option value="compose">Compose</option>
            <option value="preset_nestjs">NestJS</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>에이전트 <span className="text-service-color">*</span></label>
        {agents.length === 0
          ? <p className="text-secondary-text-color text-xs py-1">연결된 에이전트가 없습니다.</p>
          : <select className={inputCls} value={form.agentIndex} onChange={e => set('agentIndex', e.target.value)}>
            {agents.map(a => <option key={a.agentIndex} value={a.agentIndex}>{a.agentCode}</option>)}
          </select>
        }
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className={labelCls}>환경 변수</label>
          <button type="button" onClick={addEnvEntry} className="flex items-center gap-1 text-xs text-secondary-text-color hover:text-primary-text-color transition-colors cursor-pointer">
            <Plus className="w-3 h-3" />
            추가
          </button>
        </div>
        {envEntries.length > 0 && (
          <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
            {envEntries.map((entry, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input className={inputCls} placeholder="KEY" value={entry.key} onChange={e => updateEnvEntry(i, 'key', e.target.value)} />
                <input className={inputCls} placeholder="VALUE" value={entry.value} onChange={e => updateEnvEntry(i, 'value', e.target.value)} />
                <button type="button" onClick={() => removeEnvEntry(i)} className="text-secondary-text-color hover:text-red-400 transition-colors cursor-pointer shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-sm bg-red-500/10 border border-red-500/30 px-3 py-2">
          <span className="text-xs text-red-400">{error}</span>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={closeModal}
          disabled={loading}
          className="px-4 py-1.5 rounded-sm text-sm text-secondary-text-color hover:text-primary-text-color border border-border-color hover:border-border-color/80 hover:bg-white/5 transition-colors duration-100 cursor-pointer disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || agents.length === 0}
          className="flex items-center gap-2 px-4 py-1.5 rounded-sm text-sm font-semibold bg-service-color hover:opacity-80 text-white transition-opacity duration-100 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          등록
        </button>
      </div>
    </form>
  );
}

/* ─── ServiceCard ────────────────────────────────────────── */

function ServiceCard({ service }: { service: ServiceItem }) {
  return (
    <div className="border border-border-color rounded-md bg-modal-box-color overflow-hidden">
      <div className="px-4 py-4 flex items-start gap-3">
        <div className="relative w-9 h-9 rounded-md bg-white/5 flex items-center justify-center shrink-0">
          <Package className="w-4.5 h-4.5 text-secondary-text-color" />
          <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-modal-box-color ${statusDot[service.serviceStatus]}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-primary-text-color font-semibold text-sm truncate">{service.serviceName}</span>
            <span className="text-secondary-text-color/60 text-[10px] shrink-0">{presetLabel[service.serviceDeployPreset]}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px]">
            <span className={`font-medium ${service.serviceStatus === 'running' ? 'text-green-400' : service.serviceStatus === 'failed' ? 'text-red-400' : 'text-secondary-text-color'}`}>
              {statusLabel[service.serviceStatus]}
            </span>
            {service.agentCode && (
              <>
                <span className="text-secondary-text-color/40">·</span>
                <span className="font-mono text-secondary-text-color/60">{service.agentCode}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pb-3 flex flex-col gap-1.5">
        {service.serviceSourceUrl && (
          <div className="flex items-center gap-1.5 text-xs text-secondary-text-color/70">
            <GitBranch className="w-3 h-3 shrink-0" />
            <span className="font-mono truncate">{service.serviceSourceUrl}</span>
          </div>
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-border-color flex items-center justify-between">
        <span className="text-secondary-text-color/60 text-[10px] font-mono">v{service.serviceVersion}</span>
        <span className="text-secondary-text-color/60 text-[10px]">:{service.servicePort}</span>
      </div>
    </div>
  );
}

/* ─── Services Page ──────────────────────────────────────── */

export default function Services() {
  const { currentWorkspace } = useWorkspace();
  const { logout } = useAuth();
  const { openModal } = useModal();
  const navigate = useNavigate();
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchServices = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/v1/workspace/${currentWorkspace.workspaceIndex}/services`, {}, logout);
      const body = await res.json() as { data: { services: ServiceItem[] } };
      setServices(body.data.services);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace, logout]);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  useEffect(() => {
    const socket = io(`${import.meta.env.VITE_API_URL}/console`, {
      transports: ['websocket'],
      reconnection: true,
    });
    socket.on('agent-updated', () => { void fetchServices(); });
    socket.on('service-status', (data: { serviceIndex: number; status: ServiceItem['serviceStatus'] }) => {
      setServices(prev =>
        prev.map(s => s.serviceIndex === data.serviceIndex ? { ...s, serviceStatus: data.status } : s)
      );
    });
    return () => { socket.disconnect(); };
  }, [fetchServices]);

  function openCreateModal() {
    if (!currentWorkspace) return;
    openModal('서비스 등록', <CreateServiceForm workspaceIdx={currentWorkspace.workspaceIndex} onCreated={() => { void fetchServices(); }} />);
  }

  return (
    <div className="text-primary-text-color mt-20">
      <h1 className="text-lg font-bold mb-1">Services</h1>
      <p className="text-secondary-text-color text-sm mb-6">
        현재 워크스페이스에 연결된 에이전트의 서비스 목록입니다.
      </p>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-primary-text-color">
          서비스 목록
          {services.length > 0 && <span className="ml-2 text-secondary-text-color font-normal">{services.length}</span>}
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchServices}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-secondary-text-color hover:text-primary-text-color transition-colors disabled:opacity-40 cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
          {currentWorkspace && (
            <button
              onClick={openCreateModal}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-sm bg-service-color text-white hover:opacity-80 transition-opacity cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              서비스 등록
            </button>
          )}
        </div>
      </div>

      {!currentWorkspace ? (
        <p className="text-secondary-text-color text-sm py-8 text-center">워크스페이스를 먼저 선택해주세요.</p>
      ) : loading && services.length === 0 ? (
        <div className="flex items-center gap-2 text-secondary-text-color text-sm py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          불러오는 중...
        </div>
      ) : services.length === 0 ? (
        <p className="text-secondary-text-color text-sm py-8 text-center">등록된 서비스가 없습니다.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {services.map(service => (
            <div
              key={service.serviceIndex}
              onClick={() => navigate(`/services/${service.serviceIndex}`, { state: { service } })}
              className="cursor-pointer rounded-md border border-border-color hover:border-service-color transition-colors duration-100"
            >
              <ServiceCard service={service} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}