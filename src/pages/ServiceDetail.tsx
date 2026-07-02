import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useParams, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, GitBranch, Globe, Loader2, Package, Pencil, Play, Plus, Square, RefreshCw, Trash2, X } from "lucide-react";
import { apiFetch } from "../lib/apiFetch";
import { useAuth } from "../context/Auth.context";
import { useModal } from "../context/Modal.context";
import { useWorkspace } from "../context/Workspace.context";
import { useServiceLog } from "../hooks/useServiceLog";
import { statusDot, statusLabel, presetLabel } from "../constants/service";
import type { ServiceEndpoint, ServiceItem } from "../interfaces/ServiceItem.interface";
import ServiceForm from "../components/service/ServiceForm";
import LogPanel from "../components/service/LogPanel";

type TabKey = 'overview' | 'containers' | 'logs';

// 서비스 서브도메인 + 워크스페이스 서브도메인 → 접속 가능한 전체 URL
function buildServiceUrl(serviceSubdomain: string, workspaceSubdomain: string): string {
  if (serviceSubdomain === '') return `https://${workspaceSubdomain}.optics.run/`;
  return `https://${serviceSubdomain}.${workspaceSubdomain}.optics.run/`;
}

function parseSourceRepositories(raw: string) {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((entry) => {
        if (typeof entry === 'string') return { url: entry, rootDirectory: null };
        if (entry && typeof entry === 'object') {
          const record = entry as Record<string, unknown>;
          return {
            url: String(record.url ?? record.sourceUrl ?? ''),
            rootDirectory: record.rootDirectory ? String(record.rootDirectory) : null,
          };
        }
        return { url: '', rootDirectory: null };
      }).filter(entry => entry.url);
    }
  } catch {
    // fall through
  }
  return [{ url: raw, rootDirectory: null }];
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-2.5 border-b border-border-color/40 last:border-0">
      <span className="w-24 shrink-0 text-xs text-secondary-text-color/70">{label}</span>
      <div className="min-w-0 flex-1 text-xs text-primary-text-color">{children}</div>
    </div>
  );
}

type EndpointFormEntry = {
  componentName: string;
  subdomain: string;
  hostPort: string;
  containerPort: string;
};

type EndpointPayload = {
  componentName: string;
  subdomain: string | null;
  hostPort: number;
  containerPort: number;
};

const endpointInputCls = "h-9 w-full rounded-sm border border-border-color bg-background-color px-2.5 text-xs text-primary-text-color placeholder:text-secondary-text-color/40 outline-none transition-colors focus:border-service-color";

function defaultEndpointComponentName(service: ServiceItem) {
  return service.serviceDeployPreset === 'compose' ? service.serviceName : 'app';
}

function endpointEntriesFromService(service: ServiceItem): EndpointFormEntry[] {
  if (service.endpoints && service.endpoints.length > 0) {
    return service.endpoints.map(endpoint => ({
      componentName: endpoint.componentName ?? defaultEndpointComponentName(service),
      subdomain: endpoint.subdomain === '' ? '@' : endpoint.subdomain ?? '',
      hostPort: String(endpoint.hostPort),
      containerPort: String(endpoint.containerPort),
    }));
  }

  const hostPort = service.serviceHostPort ?? service.servicePort;
  const containerPort = service.serviceContainerPort ?? service.servicePort;
  return [{
    componentName: defaultEndpointComponentName(service),
    subdomain: service.serviceSubdomain === '' ? '@' : service.serviceSubdomain ?? '',
    hostPort: String(hostPort),
    containerPort: String(containerPort),
  }];
}

function cleanEndpointEntries(entries: EndpointFormEntry[]) {
  return entries
    .filter(entry =>
      entry.componentName.trim() ||
      entry.subdomain.trim() ||
      entry.hostPort.trim() ||
      entry.containerPort.trim()
    )
    .map(entry => ({
      componentName: entry.componentName.trim(),
      subdomain: entry.subdomain.trim().toLowerCase(),
      hostPort: entry.hostPort.trim(),
      containerPort: entry.containerPort.trim(),
    }));
}

function isValidEndpointPort(value: string) {
  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

function isValidEndpointSubdomain(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized === '' || normalized === '@' || /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(normalized);
}

function EndpointEditor({
  service,
  onSaved,
  onClose,
  logout,
}: {
  service: ServiceItem;
  onSaved: (servicePatch: Partial<ServiceItem>) => void;
  onClose: () => void;
  logout: () => void;
}) {
  const [entries, setEntries] = useState<EndpointFormEntry[]>(() => endpointEntriesFromService(service));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addEndpoint() {
    const first = entries[0] ?? endpointEntriesFromService(service)[0];
    setEntries(prev => [
      ...prev,
      {
        componentName: defaultEndpointComponentName(service),
        subdomain: '',
        hostPort: first?.hostPort ?? String(service.serviceHostPort ?? service.servicePort),
        containerPort: first?.containerPort ?? String(service.serviceContainerPort ?? service.servicePort),
      },
    ]);
  }

  function updateEndpoint(index: number, field: keyof EndpointFormEntry, value: string) {
    setError(null);
    setEntries(prev => prev.map((entry, i) => i === index ? { ...entry, [field]: value } : entry));
  }

  function removeEndpoint(index: number) {
    setError(null);
    setEntries(prev => prev.filter((_, i) => i !== index));
  }

  function validate() {
    const cleaned = cleanEndpointEntries(entries);
    for (const endpoint of cleaned) {
      if (!isValidEndpointPort(endpoint.hostPort)) return '외부 포트는 1-65535 사이 숫자로 입력해주세요.';
      if (!isValidEndpointPort(endpoint.containerPort)) return '내부 포트는 1-65535 사이 숫자로 입력해주세요.';
      if (!isValidEndpointSubdomain(endpoint.subdomain)) return '서브도메인은 소문자/숫자/하이픈 또는 @만 사용할 수 있습니다.';
    }

    const publicSubdomains = cleaned
      .map(endpoint => endpoint.subdomain === '@' ? '' : endpoint.subdomain)
      .filter(subdomain => subdomain !== '');
    if (new Set(publicSubdomains).size !== publicSubdomains.length) return '서브도메인이 중복되었습니다.';
    if (cleaned.filter(endpoint => endpoint.subdomain === '@').length > 1) return '루트 엔드포인트(@)는 하나만 등록할 수 있습니다.';
    return null;
  }

  async function saveEndpoints() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const serviceEndpoints: EndpointPayload[] = cleanEndpointEntries(entries).map(endpoint => ({
      componentName: endpoint.componentName || defaultEndpointComponentName(service),
      subdomain: endpoint.subdomain === '' ? null : endpoint.subdomain,
      hostPort: parseInt(endpoint.hostPort, 10),
      containerPort: parseInt(endpoint.containerPort, 10),
    }));

    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/v1/service/${service.serviceIndex}/endpoints`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceEndpoints }),
      }, logout);
      if (!res.ok) {
        const data = await res.json() as { message?: string };
        setError(data.message ?? '저장에 실패했습니다.');
        return;
      }
      const body = await res.json() as {
        data?: {
          service?: {
            serviceSubdomain?: string | null;
            endpoints?: Omit<ServiceEndpoint, 'endpointIndex'>[];
          };
        };
      };
      const savedEndpoints = body.data?.service?.endpoints?.map((endpoint, index) => ({
        endpointIndex: index,
        componentName: endpoint.componentName,
        subdomain: endpoint.subdomain,
        hostPort: endpoint.hostPort,
        containerPort: endpoint.containerPort,
      }));
      onSaved({
        serviceSubdomain: body.data?.service?.serviceSubdomain ?? null,
        ...(savedEndpoints && { endpoints: savedEndpoints }),
      });
      onClose();
    } catch (error) {
      console.log(error);
      setError('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs leading-relaxed text-secondary-text-color">
          공개할 서브도메인과 연결할 포트를 지정합니다. @는 워크스페이스 루트 도메인입니다.
        </p>
        <button
          type="button"
          onClick={addEndpoint}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-sm border border-border-color px-2.5 text-xs text-secondary-text-color transition-colors hover:border-border-strong-color hover:text-primary-text-color cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          추가
        </button>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_18px] gap-2 px-0.5 text-[10px] font-medium uppercase tracking-wider text-secondary-text-color">
        <span>컴포넌트</span>
        <span>서브도메인</span>
        <span>외부 포트</span>
        <span>내부 포트</span>
        <span />
      </div>

      <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-1">
        {entries.map((entry, index) => (
          <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_18px] items-center gap-2">
            <input
              className={endpointInputCls}
              placeholder={defaultEndpointComponentName(service)}
              value={entry.componentName}
              onChange={e => updateEndpoint(index, 'componentName', e.target.value)}
            />
            <input
              className={endpointInputCls}
              placeholder="api 또는 @"
              value={entry.subdomain}
              onChange={e => updateEndpoint(index, 'subdomain', e.target.value)}
            />
            <input
              className={endpointInputCls}
              type="number"
              min={1}
              max={65535}
              placeholder="외부"
              value={entry.hostPort}
              onChange={e => updateEndpoint(index, 'hostPort', e.target.value)}
            />
            <input
              className={endpointInputCls}
              type="number"
              min={1}
              max={65535}
              placeholder="내부"
              value={entry.containerPort}
              onChange={e => updateEndpoint(index, 'containerPort', e.target.value)}
            />
            <button type="button" onClick={() => removeEndpoint(index)} className="text-secondary-text-color hover:text-red-400 transition-colors cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {entries.length === 0 && (
        <div className="rounded-sm border border-border-color bg-background-color px-3 py-2 text-xs text-secondary-text-color">
          저장하면 첫 번째 포트 매핑 기준의 기본 엔드포인트가 생성됩니다.
        </div>
      )}

      {error && <p className="rounded-sm border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>}

      <div className="flex justify-end gap-2 border-t border-border-color pt-3">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="h-8 rounded-sm border border-border-color px-3 text-xs text-secondary-text-color transition-colors hover:bg-white/5 hover:text-primary-text-color cursor-pointer disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="button"
          onClick={() => { void saveEndpoints(); }}
          disabled={saving}
          className="inline-flex h-8 items-center gap-2 rounded-sm bg-service-color px-3.5 text-xs font-semibold text-white transition-opacity hover:opacity-80 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          저장
        </button>
      </div>
    </div>
  );
}

export default function ServiceDetail() {
  const { serviceIndex } = useParams<{ serviceIndex: string }>();
  const { state } = useLocation() as { state: { service: ServiceItem } | null };
  const navigate = useNavigate();

  const [service, setService] = useState<ServiceItem | null>(state?.service ?? null);
  const [serviceLoading, setServiceLoading] = useState(!state?.service);
  const { logout } = useAuth();
  const { openModal, closeModal } = useModal();
  const { currentWorkspace } = useWorkspace();

  const [activeTab, setActiveTab] = useState<TabKey>('logs');

  const [subdomainEditing, setSubdomainEditing] = useState(false);
  const [subdomainInput, setSubdomainInput] = useState('');
  const [subdomainError, setSubdomainError] = useState<string | null>(null);

  const {
    logs, setLogs,
    expandedSessions, setExpandedSessions,
    currentSessionId,
    containers,
    containerCounts,
    logLoadProgress,
    isLoadingOlderLogs,
    hasOlderLogs,
    loadOlderLogs,
    logEndRef,
    onServiceStatusChangeRef,
  } = useServiceLog(service, serviceIndex, currentWorkspace?.workspaceIndex);

  useEffect(() => {
    onServiceStatusChangeRef.current = (status: ServiceItem['serviceStatus']) => {
      setService(prev => prev ? { ...prev, serviceStatus: status } : prev);
    };
  }, [onServiceStatusChangeRef]);

  const fetchService = useCallback(async () => {
    if (!currentWorkspace || !serviceIndex) return;
    setServiceLoading(true);
    try {
      const res = await apiFetch(`/v1/service/workspace/${currentWorkspace.workspaceIndex}`, {}, logout);
      if (!res.ok) {
        setService(null);
        return;
      }
      const body = await res.json() as { data: { services: ServiceItem[] } };
      const found = body.data.services.find(item => item.serviceIndex === Number(serviceIndex)) ?? null;
      setService(found);
    } catch (error) {
      console.log(error);
      setService(null);
    } finally {
      setServiceLoading(false);
    }
  }, [currentWorkspace, serviceIndex, logout]);

  useEffect(() => {
    void fetchService();
  }, [fetchService]);

  if (!service && serviceLoading) {
    return (
      <div className="text-primary-text-color mt-20 flex flex-col items-center gap-3">
        <p className="text-secondary-text-color text-sm">서비스 정보를 불러오는 중...</p>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="text-primary-text-color mt-20 flex flex-col items-center gap-3">
        <p className="text-secondary-text-color text-sm">서비스 정보를 찾을 수 없습니다.</p>
        <Link to="/services" className="flex items-center gap-1.5 text-xs text-secondary-text-color hover:text-primary-text-color transition-colors cursor-pointer">
          <ArrowLeft className="w-3 h-3" />
          목록으로
        </Link>
      </div>
    );
  }
  const isRemoved = service.serviceStatus === 'removed';
  const serviceSubdomain = service.serviceSubdomain ?? null;
  const hasServiceSubdomain = serviceSubdomain !== null;
  const serviceUrl = hasServiceSubdomain && currentWorkspace?.workspaceSubdomain && currentWorkspace.workspaceSubdomainActive
    ? buildServiceUrl(serviceSubdomain, currentWorkspace.workspaceSubdomain)
    : null;
  const portMappings = service.servicePortMappings && service.servicePortMappings.length > 0
    ? service.servicePortMappings
    : [{ hostPort: service.serviceHostPort ?? service.servicePort, containerPort: service.serviceContainerPort ?? service.servicePort }];
  const endpoints = service.endpoints ?? [];
  const components = service.components ?? [];

  async function handleStartService() {
    try {
      const res = await apiFetch(`/v1/service/${serviceIndex}/start`, { method: 'POST' }, logout);
      if (!res.ok) console.log(await res.json());
    } catch (error) {
      console.log(error);
    }
  }

  async function handleStopService() {
    try {
      const res = await apiFetch(`/v1/service/${serviceIndex}/stop`, { method: 'POST' }, logout);
      if (!res.ok) console.log(await res.json());
    } catch (error) {
      console.log(error);
    }
  }

  async function handleContainerAction(containerName: string, action: 'start' | 'stop' | 'restart') {
    if (!serviceIndex) return;
    try {
      const res = await apiFetch(`/v1/service/${serviceIndex}/containers/${encodeURIComponent(containerName)}/${action}`, { method: 'POST' }, logout);
      if (!res.ok) console.log(await res.json());
    } catch (error) {
      console.log(error);
    }
  }

  async function handleSaveSubdomain() {
    const rawValue = subdomainInput.trim().toLowerCase();
    if (rawValue !== '' && rawValue !== '@' && (rawValue.length > 63 || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(rawValue))) {
      setSubdomainError('소문자/숫자/하이픈 또는 @만 사용할 수 있습니다.');
      return;
    }
    try {
      const res = await apiFetch(`/v1/service/${serviceIndex}/subdomain`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain: rawValue === '' ? null : rawValue }),
      }, logout);
      if (!res.ok) {
        setSubdomainError(res.status === 409 ? '이미 사용 중인 서브도메인입니다.' : '저장에 실패했습니다.');
        return;
      }
      const body = await res.json() as { data?: { service?: { serviceSubdomain?: string | null } } };
      const nextSubdomain = body.data?.service?.serviceSubdomain ?? null;
      setService(prev => prev ? { ...prev, serviceSubdomain: nextSubdomain } : prev);
      setSubdomainEditing(false);
      setSubdomainError(null);
    } catch (error) {
      console.log(error);
      setSubdomainError('저장에 실패했습니다.');
    }
  }

  async function deleteService(deleteScope: 'containers' | 'service') {
    if (!service) return;
    try {
      const res = await apiFetch(`/v1/service/${serviceIndex}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteScope }),
      }, logout);
      if (res.ok) {
        closeModal();
        if (deleteScope === 'service') navigate('/services');
        else void fetchService();
      }
      else console.log(await res.json());
    } catch (error) {
      console.log(error);
    }
  }

  function handleDeleteService() {
    if (!service) return;
    openModal('서비스 삭제', (
      <div className="space-y-4">
        <p className="text-xs text-secondary-text-color">
          '{service.serviceName}' 삭제 범위를 선택하세요.
        </p>
        <div className="space-y-2">
          <button
            onClick={() => { void deleteService('containers'); }}
            className="w-full text-left rounded-md border border-border-color px-3 py-2.5 hover:border-service-color transition-colors cursor-pointer"
          >
            <span className="block text-xs font-semibold text-primary-text-color">컨테이너만 삭제</span>
            <span className="block text-[10px] text-secondary-text-color mt-1">
              Hub 서비스 정보는 유지하고 실행 컨테이너, 이미지, 볼륨, Agent 로그 세션 마커를 삭제합니다.
            </span>
          </button>
          <button
            onClick={() => { void deleteService('service'); }}
            className="w-full text-left rounded-md border border-red-500/40 px-3 py-2.5 hover:border-red-400 transition-colors cursor-pointer"
          >
            <span className="block text-xs font-semibold text-red-400">서비스 전체 삭제</span>
            <span className="block text-[10px] text-secondary-text-color mt-1">
              컨테이너와 Agent 로컬 데이터를 삭제하고 Hub 서비스 목록에서도 제거합니다.
            </span>
          </button>
        </div>
      </div>
    ));
  }

  function handleEditEndpoints() {
    if (!service) return;
    openModal('엔드포인트 편집', (
      <EndpointEditor
        service={service}
        logout={logout}
        onClose={() => closeModal({ force: true })}
        onSaved={(servicePatch) => {
          setService(prev => prev ? { ...prev, ...servicePatch } : prev);
          void fetchService();
        }}
      />
    ));
  }

  const sourceRepositories = (() => {
    if (!service.serviceSourceUrl) return [];
    return parseSourceRepositories(service.serviceSourceUrl);
  })();

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: '개요' },
    { key: 'containers', label: containers.length > 0 ? `컨테이너 (${containers.length})` : '컨테이너' },
    { key: 'logs', label: '로그' },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden pt-20 text-primary-text-color">

      {/* 뒤로가기 */}
      <Link
        to="/services"
        className="mb-4 flex w-fit shrink-0 items-center gap-1.5 text-xs text-secondary-text-color hover:text-primary-text-color transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-3 h-3" />
        목록으로
      </Link>

      {/* 헤더: 정체성 + 제어 */}
      <div className="mb-4 flex shrink-0 items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <div className="relative w-10 h-10 rounded-md bg-modal-box-color border border-border-color flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-secondary-text-color" />
            <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-background-color ${statusDot[service.serviceStatus]}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-lg font-bold truncate">{service.serviceName}</h1>
              <span className="text-secondary-text-color/60 text-xs shrink-0">{presetLabel[service.serviceDeployPreset]}</span>
            </div>
            <span className={`text-xs ${service.serviceStatus === 'running' ? 'text-green-400' : service.serviceStatus === 'failed' ? 'text-red-400' : service.serviceStatus === 'starting' || service.serviceStatus === 'building' ? 'text-yellow-400' : 'text-secondary-text-color'}`}>
              {statusLabel[service.serviceStatus]}
              {containerCounts && containerCounts.total > 0 && (
                <span className="text-secondary-text-color/60 ml-0.5">
                  ({containerCounts.running}/{containerCounts.total})
                </span>
              )}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {!isRemoved && (
            <>
              <Play className="w-4 h-4 cursor-pointer text-secondary-text-color hover:text-primary-text-color transition-colors" onClick={() => handleStartService()} />
              <Square className="w-4 h-4 cursor-pointer text-secondary-text-color hover:text-red-400 transition-colors" onClick={() => handleStopService()} />
            </>
          )}
          <RefreshCw
            className="w-4 h-4 cursor-pointer text-secondary-text-color hover:text-primary-text-color transition-colors"
            onClick={() => {
              if (!service || !currentWorkspace) return;
              openModal('재배포', <ServiceForm mode="redeploy" workspaceIndex={currentWorkspace.workspaceIndex} service={service} onSuccess={() => { void fetchService(); }} />);
            }}
          />
          <Trash2 className="w-4 h-4 cursor-pointer text-secondary-text-color hover:text-red-400 transition-colors" onClick={() => handleDeleteService()} />
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
            <InfoRow label="버전">v{service.serviceVersion}</InfoRow>
            <InfoRow label="포트">
              <div className="flex flex-col gap-1 font-mono">
                {portMappings.map(mapping => (
                  <span key={`${mapping.hostPort}:${mapping.containerPort}`}>:{mapping.hostPort} -&gt; :{mapping.containerPort}</span>
                ))}
              </div>
            </InfoRow>
            <InfoRow label="엔드포인트">
              <div className="flex min-w-0 items-start gap-2">
                <div className="min-w-0 flex-1">
                  {endpoints.length === 0 ? (
                    <span className="font-mono text-secondary-text-color/50">미설정</span>
                  ) : (
                    <div className="flex flex-col gap-1 font-mono">
                      {endpoints.map(endpoint => {
                        const label = endpoint.subdomain === ''
                          ? '@'
                          : endpoint.subdomain ?? 'internal';
                        return (
                          <span key={endpoint.endpointIndex} className="truncate">
                            {label} -&gt; {endpoint.componentName ?? 'app'}:{endpoint.containerPort}
                            <span className="text-secondary-text-color/50"> / host :{endpoint.hostPort}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                {!isRemoved && (
                  <button
                    type="button"
                    onClick={handleEditEndpoints}
                    className="mt-0.5 shrink-0 text-secondary-text-color/60 transition-colors hover:text-primary-text-color cursor-pointer"
                    aria-label="엔드포인트 편집"
                  >
                    {endpoints.length === 0 ? <Plus className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            </InfoRow>
            {components.length > 0 && (
              <InfoRow label="컴포넌트">
                <div className="flex flex-col gap-1">
                  {components.map(component => (
                    <span key={component.componentIndex} className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        component.status === 'running' ? 'bg-green-400'
                        : component.status === 'building' || component.status === 'starting' || component.status === 'restarting' ? 'bg-yellow-400'
                        : component.status === 'failed' ? 'bg-red-400'
                        : 'bg-secondary-text-color/40'
                      }`} />
                      <span className="font-mono">{component.componentName}</span>
                      <span className="text-secondary-text-color/60">{component.status}</span>
                    </span>
                  ))}
                </div>
              </InfoRow>
            )}
            <InfoRow label="에이전트">
              {service.agentName ?? <span className="text-secondary-text-color/50">미연결</span>}
            </InfoRow>
            <InfoRow label="소스">
              {sourceRepositories.length === 0
                ? <span className="text-secondary-text-color/50">없음</span>
                : (
                  <div className="flex flex-col gap-0.5">
                    {sourceRepositories.map((source, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-secondary-text-color/80">
                        <GitBranch className="w-3 h-3 shrink-0" />
                        <span className="font-mono truncate">
                          {source.url}{source.rootDirectory ? ` / ${source.rootDirectory}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
            </InfoRow>
            <InfoRow label="서브도메인">
              <div className="flex items-center gap-1.5">
                <Globe className="w-3 h-3 shrink-0 text-secondary-text-color/60" />
                {subdomainEditing ? (
                  <>
                    <input
                      value={subdomainInput}
                      onChange={e => { setSubdomainInput(e.target.value); setSubdomainError(null); }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') void handleSaveSubdomain();
                        if (e.key === 'Escape') { setSubdomainEditing(false); setSubdomainError(null); }
                      }}
                      placeholder="api 또는 @"
                      autoFocus
                      className="w-40 rounded border border-border-color bg-transparent px-1.5 py-0.5 font-mono text-xs text-primary-text-color outline-none focus:border-service-color"
                    />
                    <Check className="w-3 h-3 cursor-pointer text-secondary-text-color hover:text-green-400 transition-colors" onClick={() => { void handleSaveSubdomain(); }} />
                    <X className="w-3 h-3 cursor-pointer text-secondary-text-color hover:text-red-400 transition-colors" onClick={() => { setSubdomainEditing(false); setSubdomainError(null); }} />
                  </>
                ) : (
                  <>
                    {serviceUrl ? (
                      <a
                        href={serviceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-service-color hover:underline truncate"
                      >
                        {serviceUrl}
                      </a>
                    ) : hasServiceSubdomain && currentWorkspace?.workspaceSubdomain ? (
                      <span className="font-mono text-secondary-text-color/70">
                        {buildServiceUrl(serviceSubdomain, currentWorkspace.workspaceSubdomain)}
                        <span className="ml-1 text-secondary-text-color/50">(비활성)</span>
                      </span>
                    ) : (
                      <span className="font-mono text-secondary-text-color/50">미설정</span>
                    )}
                    {!isRemoved && (
                      <Pencil
                        className="w-3 h-3 shrink-0 cursor-pointer text-secondary-text-color/60 hover:text-primary-text-color transition-colors"
                        onClick={() => { setSubdomainInput(service.serviceSubdomain === '' ? '@' : service.serviceSubdomain ?? ''); setSubdomainEditing(true); }}
                      />
                    )}
                  </>
                )}
                {subdomainError && <span className="text-red-400">{subdomainError}</span>}
              </div>
            </InfoRow>
            <InfoRow label="생성일">
              <span className="text-secondary-text-color/80">{new Date(service.serviceCreatedAt).toLocaleString()}</span>
            </InfoRow>
          </div>
        )}

        {activeTab === 'containers' && (
          <div className="overflow-y-auto pr-1">
            {containers.length === 0 ? (
              <p className="py-6 text-center text-xs text-secondary-text-color/50">실행 중인 컨테이너가 없습니다.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {containers.map(c => (
                  <div key={c.name} className="flex items-center gap-2 rounded-md border border-border-color/50 px-3 py-2 text-xs">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      c.status === 'running' ? 'bg-green-400'
                      : c.status === 'starting' || c.status === 'building' ? 'bg-yellow-400 animate-pulse'
                      : c.status === 'failed' ? 'bg-red-400'
                      : 'bg-secondary-text-color/40'
                    }`} />
                    <span className="font-mono text-secondary-text-color/80">{c.name}</span>
                    {c.service && c.service !== c.name && (
                      <span className="text-secondary-text-color/40">{c.service}</span>
                    )}
                    <span className={
                      c.status === 'running' ? 'text-green-400'
                      : c.status === 'starting' || c.status === 'building' ? 'text-yellow-400'
                      : c.status === 'failed' ? 'text-red-400'
                      : 'text-secondary-text-color/50'
                    }>{c.status}</span>
                    {c.health && (
                      <span className="text-secondary-text-color/40">health: {c.health}</span>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                      {!isRemoved && (c.status === 'stopped' || c.status === 'failed') && (
                        <Play className="w-3 h-3 cursor-pointer text-secondary-text-color hover:text-primary-text-color transition-colors" onClick={() => { void handleContainerAction(c.name, 'start'); }} />
                      )}
                      {!isRemoved && (c.status === 'running' || c.status === 'starting') && (
                        <Square className="w-3 h-3 cursor-pointer text-secondary-text-color hover:text-primary-text-color transition-colors" onClick={() => { void handleContainerAction(c.name, 'stop'); }} />
                      )}
                      {!isRemoved && c.status === 'running' && (
                        <RefreshCw className="w-3 h-3 cursor-pointer text-secondary-text-color hover:text-primary-text-color transition-colors" onClick={() => { void handleContainerAction(c.name, 'restart'); }} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'logs' && (
          <LogPanel
            logs={logs}
            currentSessionId={currentSessionId}
            expandedSessions={expandedSessions}
            setExpandedSessions={setExpandedSessions}
            onClear={() => setLogs([])}
            logEndRef={logEndRef}
            logLoadProgress={logLoadProgress}
            isLoadingOlderLogs={isLoadingOlderLogs}
            hasOlderLogs={hasOlderLogs}
            onLoadOlder={loadOlderLogs}
          />
        )}
      </div>

    </div>
  );
}
