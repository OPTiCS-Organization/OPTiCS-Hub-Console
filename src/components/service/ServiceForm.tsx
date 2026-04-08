import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { apiFetch } from "../../lib/apiFetch";
import { useAuth } from "../../context/Auth.context";
import { useModal } from "../../context/Modal.context";
import { useAgents } from "../../hooks/useAgents";
import { inputCls, labelCls } from "../ui/Field";
import type { EnvEntry } from "../../interfaces/EnvEntry.interface";
import type { ServiceItem } from "../../interfaces/ServiceItem.interface";

interface ServiceFormProps {
  mode: 'create' | 'redeploy';
  workspaceIndex: number;
  onSuccess: () => void;
  service?: ServiceItem;
}

export default function ServiceForm({ mode, workspaceIndex, onSuccess, service }: ServiceFormProps) {
  const { logout } = useAuth();
  const { closeModal } = useModal();
  const agents = useAgents(workspaceIndex, logout);

  const parseUrls = (raw?: string): string[] => {
    if (!raw) return [''];
    try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : [raw]; }
    catch { return [raw]; }
  };

  const [form, setForm] = useState({
    serviceName: service?.serviceName ?? '',
    servicePort: service ? String(service.servicePort) : '',
    serviceVersion: service?.serviceVersion ?? '1.0.0',
    serviceDeployPreset: (service?.serviceDeployPreset ?? 'dockerfile') as string,
    agentIndex: service ? String(service.agentIndex) : '',
  });
  const [sourceUrls, setSourceUrls] = useState<string[]>(parseUrls(service?.serviceSourceUrl));
  const [envEntries, setEnvEntries] = useState<EnvEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 에이전트 목록이 로드되면 기본값 세팅
  if (!form.agentIndex && agents.length > 0) {
    setForm(f => ({ ...f, agentIndex: String(agents[0].agentIndex) }));
  }

  function set(key: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [key]: value }));
    if (key === 'serviceDeployPreset' && value !== 'compose') {
      setSourceUrls(prev => [prev[0] ?? '']);
    }
  }

  function setUrl(index: number, value: string) {
    setSourceUrls(prev => prev.map((u, i) => i === index ? value : u));
  }

  function addUrl() { setSourceUrls(prev => [...prev, '']); }
  function removeUrl(index: number) { setSourceUrls(prev => prev.filter((_, i) => i !== index)); }
  function addEnvEntry() { setEnvEntries(prev => [...prev, { key: '', value: '' }]); }
  function updateEnvEntry(index: number, field: 'key' | 'value', val: string) {
    setEnvEntries(prev => prev.map((e, i) => i === index ? { ...e, [field]: val } : e));
  }
  function removeEnvEntry(index: number) { setEnvEntries(prev => prev.filter((_, i) => i !== index)); }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const sourceUrl = sourceUrls.length === 1 ? sourceUrls[0] : sourceUrls;
    const env = Object.fromEntries(envEntries.filter(e => e.key.trim()).map(e => [e.key, e.value]));

    const url = mode === 'create'
      ? '/v1/workspace/services/deploy'
      : `/v1/workspace/services/${service!.serviceIndex}/redeploy`;

    const body = mode === 'create'
      ? {
        workspaceIdx: workspaceIndex,
        serviceName: form.serviceName,
        servicePort: parseInt(form.servicePort),
        serviceSourceUrl: sourceUrl,
        serviceVersion: form.serviceVersion,
        serviceDeployPreset: form.serviceDeployPreset,
        agentIndex: parseInt(form.agentIndex),
        env,
      }
      : {
        serviceName: form.serviceName,
        servicePort: parseInt(form.servicePort),
        serviceSourceUrl: sourceUrl,
        serviceVersion: form.serviceVersion,
        serviceDeployPreset: form.serviceDeployPreset,
        agentIndex: parseInt(form.agentIndex),
        ...(Object.keys(env).length > 0 && { env }),
      };

    try {
      const res = await apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }, logout);
      if (!res.ok) {
        const data = await res.json() as { message?: string };
        setError(data.message ?? 'Failed.');
        return;
      }
      onSuccess();
      closeModal();
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  }

  const isCompose = form.serviceDeployPreset === 'compose';
  const submitLabel = mode === 'create' ? '등록' : '재배포';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>서비스명 <span className="text-service-color">*</span></label>
        <input className={inputCls} placeholder="my-service" value={form.serviceName} onChange={e => set('serviceName', e.target.value)} autoFocus required />
      </div>

      <div className="flex gap-3">
        <div className="flex-1 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className={labelCls}>소스 URL <span className="text-service-color">*</span></label>
            {isCompose && (
              <button type="button" onClick={addUrl} className="flex items-center gap-1 text-xs text-secondary-text-color hover:text-primary-text-color transition-colors cursor-pointer">
                <Plus className="w-3 h-3" />
                URL 추가
              </button>
            )}
          </div>
          <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
            {sourceUrls.map((url, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  className={inputCls}
                  placeholder={i === 0 ? "https://github.com/..." : "https://github.com/... (추가 레포)"}
                  value={url}
                  onChange={e => setUrl(i, e.target.value)}
                  required={i === 0}
                />
                {isCompose && sourceUrls.length > 1 && (
                  <button type="button" onClick={() => removeUrl(i)} className="text-secondary-text-color hover:text-red-400 transition-colors cursor-pointer shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
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
            {agents.map(a => <option key={a.agentIndex} value={a.agentIndex}>{a.agentName}</option>)}
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
          type="button" onClick={closeModal} disabled={loading}
          className="px-4 py-1.5 rounded-sm text-sm text-secondary-text-color hover:text-primary-text-color border border-border-color hover:border-border-color/80 hover:bg-white/5 transition-colors duration-100 cursor-pointer disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit" disabled={loading || agents.length === 0}
          className="flex items-center gap-2 px-4 py-1.5 rounded-sm text-sm font-semibold bg-service-color hover:opacity-80 text-white transition-opacity duration-100 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
