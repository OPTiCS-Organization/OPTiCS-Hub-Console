import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useParams, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, GitBranch, Loader2, Package, Pencil, Play, Plus, Square, RefreshCw, Trash2, X } from "lucide-react";
import { apiFetch } from "../lib/apiFetch";
import { useAuth } from "../context/Auth.context";
import { useModal } from "../context/Modal.context";
import { useWorkspace } from "../context/Workspace.context";
import { useServiceLog } from "../hooks/useServiceLog";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { statusDot, statusLabel, presetLabel } from "../constants/service";
import type { ServiceEndpoint, ServiceItem } from "../interfaces/ServiceItem.interface";
import ServiceForm from "../components/service/ServiceForm";
import LogPanel from "../components/service/LogPanel";
import Tooltip from "../components/ui/Tooltip";
import { dangerNoticeClass } from "../constants/danger";

type TabKey = 'overview' | 'containers' | 'logs';

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

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_18px] gap-2 px-0.5 text-3xs font-medium uppercase tracking-wider text-secondary-text-color">
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
            <Tooltip label="엔드포인트 제거">
              <button type="button" onClick={() => removeEndpoint(index)} aria-label="엔드포인트 제거" className="text-secondary-text-color hover:text-danger-color transition-colors cursor-pointer focus-visible:outline-none focus-visible:text-danger-color">
                <X className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          </div>
        ))}
      </div>

      {entries.length === 0 && (
        <div className="rounded-sm border border-border-color bg-background-color px-3 py-2 text-xs text-secondary-text-color">
          저장하면 첫 번째 포트 매핑 기준의 기본 엔드포인트가 생성됩니다.
        </div>
      )}

      {error && <p className={`${dangerNoticeClass} text-xs text-danger-color`}>{error}</p>}

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

  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const {
    logs, clearLogs,
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
      <div className="text-primary-text-color mt-16 flex flex-col items-center gap-3">
        <p className="text-secondary-text-color text-sm">서비스 정보를 불러오는 중...</p>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="text-primary-text-color mt-16 flex flex-col items-center gap-3">
        <p className="text-secondary-text-color text-sm">서비스 정보를 찾을 수 없습니다.</p>
        <Link to="/services" className="flex items-center gap-1.5 text-xs text-secondary-text-color hover:text-primary-text-color transition-colors cursor-pointer">
          <ArrowLeft className="w-3 h-3" />
          목록으로
        </Link>
      </div>
    );
  }
  const isRemoved = service.serviceStatus === 'removed';
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

  // 삭제 범위를 고른 뒤 반드시 한 번 더 확인받는다. 예전에는 범위 버튼을 누르는
  // 순간 바로 지워져서, 이 앱에서 가장 되돌릴 수 없는 동작에 마찰이 하나도 없었다.
  function confirmDeleteScope(scope: 'containers' | 'service') {
    if (!service) return;

    if (scope === 'containers') {
      openModal('컨테이너 삭제 확인', (
        <ConfirmDialog
          tone="danger"
          target={{ name: service.serviceName, icon: <Trash2 className="h-4 w-4" /> }}
          impacts={[
            {
              emphasis: true,
              icon: <Square className="h-3.5 w-3.5" />,
              title: '실행 중인 컨테이너가 즉시 중지되고 삭제됩니다',
              detail: '이미지와 볼륨, Agent 로그 세션 마커도 함께 지워집니다.',
            },
            {
              icon: <RefreshCw className="h-3.5 w-3.5" />,
              title: 'Hub의 서비스 정보는 남습니다',
              detail: '같은 설정으로 다시 배포할 수 있습니다.',
            },
          ]}
          friction={{ kind: 'acknowledge', label: '컨테이너와 볼륨이 삭제되는 것을 확인했습니다.' }}
          confirmLabel="컨테이너 삭제"
          onCancel={() => closeModal()}
          onConfirm={() => deleteService('containers')}
        />
      ));
      return;
    }

    openModal('서비스 삭제 확인', (
      <ConfirmDialog
        tone="danger"
        target={{ name: service.serviceName, icon: <Trash2 className="h-4 w-4" /> }}
        impacts={[
          {
            emphasis: true,
            icon: <Trash2 className="h-3.5 w-3.5" />,
            title: '컨테이너·이미지·볼륨이 모두 삭제됩니다',
            detail: '볼륨에 담긴 데이터는 복구할 수 없습니다.',
          },
          {
            emphasis: true,
            icon: <Package className="h-3.5 w-3.5" />,
            title: 'Hub의 서비스 목록에서도 제거됩니다',
            detail: '배포 설정, 포트 매핑, 엔드포인트, 환경 변수가 함께 사라집니다.',
          },
          {
            icon: <Plus className="h-3.5 w-3.5" />,
            title: '다시 쓰려면 서비스를 처음부터 등록해야 합니다',
          },
        ]}
        friction={{
          kind: 'phrase',
          phrase: service.serviceName,
          label: '삭제하려면 서비스 이름을 그대로 입력하세요.',
        }}
        confirmLabel="서비스 전체 삭제"
        onCancel={() => closeModal()}
        onConfirm={() => deleteService('service')}
      />
    ));
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
            type="button"
            onClick={() => { confirmDeleteScope('containers'); }}
            className="w-full text-left rounded-md border border-border-color px-3 py-2.5 hover:border-service-color transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-service-color/50"
          >
            <span className="block text-xs font-semibold text-primary-text-color">컨테이너만 삭제</span>
            <span className="block text-3xs text-secondary-text-color mt-1">
              Hub 서비스 정보는 유지하고 실행 컨테이너, 이미지, 볼륨, Agent 로그 세션 마커를 삭제합니다.
            </span>
          </button>
          <button
            type="button"
            onClick={() => { confirmDeleteScope('service'); }}
            className="w-full text-left rounded-md border border-danger-color/40 px-3 py-2.5 transition-colors cursor-pointer hover:border-danger-color hover:bg-danger-color/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-color/50"
          >
            <span className="block text-xs font-semibold text-danger-color">서비스 전체 삭제</span>
            <span className="block text-3xs text-secondary-text-color mt-1">
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
            <span className={`text-xs ${service.serviceStatus === 'running' ? 'text-success-color' : service.serviceStatus === 'failed' ? 'text-danger-color' : service.serviceStatus === 'starting' || service.serviceStatus === 'building' ? 'text-warning-color' : 'text-secondary-text-color'}`}>
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
              <Tooltip label="서비스 시작">
                <button
                  type="button"
                  onClick={() => handleStartService()}
                  className="p-1 text-secondary-text-color hover:text-primary-text-color transition-colors cursor-pointer focus-visible:outline-none focus-visible:text-primary-text-color"
                  aria-label="서비스 시작"
                >
                  <Play className="w-4 h-4" />
                </button>
              </Tooltip>
              <Tooltip label="서비스 중지">
                <button
                  type="button"
                  onClick={() => handleStopService()}
                  className="p-1 rounded-sm text-secondary-text-color transition-colors cursor-pointer hover:bg-danger-color/10 hover:text-danger-color focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-color/50"
                  aria-label="서비스 중지"
                >
                  <Square className="w-4 h-4" />
                </button>
              </Tooltip>
            </>
          )}
          <Tooltip label="재배포">
            <button
              type="button"
              onClick={() => {
                if (!service || !currentWorkspace) return;
                openModal('재배포', <ServiceForm mode="redeploy" workspaceIndex={currentWorkspace.workspaceIndex} service={service} onSuccess={() => { void fetchService(); }} />);
              }}
              className="p-1 text-secondary-text-color hover:text-primary-text-color transition-colors cursor-pointer focus-visible:outline-none focus-visible:text-primary-text-color"
              aria-label="재배포"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip label="서비스 삭제">
            <button
              type="button"
              onClick={() => handleDeleteService()}
              className="p-1 rounded-sm text-secondary-text-color transition-colors cursor-pointer hover:bg-danger-color/10 hover:text-danger-color focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-color/50"
              aria-label="서비스 삭제"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </Tooltip>
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
            <InfoRow label="버전">{service.serviceVersion}</InfoRow>
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
                  <Tooltip label={endpoints.length === 0 ? "엔드포인트 추가" : "엔드포인트 편집"}>
                    <button
                      type="button"
                      onClick={handleEditEndpoints}
                      className="mt-0.5 p-0.5 shrink-0 text-secondary-text-color/60 transition-colors hover:text-primary-text-color cursor-pointer focus-visible:outline-none focus-visible:text-primary-text-color"
                      aria-label={endpoints.length === 0 ? "엔드포인트 추가" : "엔드포인트 편집"}
                    >
                      {endpoints.length === 0 ? <Plus className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                    </button>
                  </Tooltip>
                )}
              </div>
            </InfoRow>
            {components.length > 0 && (
              <InfoRow label="컴포넌트">
                <div className="flex flex-col gap-1">
                  {components.map(component => (
                    <span key={component.componentIndex} className="flex min-w-0 items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        component.status === 'running' ? 'bg-success-color'
                        : component.status === 'building' || component.status === 'starting' || component.status === 'restarting' ? 'bg-warning-color'
                        : component.status === 'failed' ? 'bg-danger-color'
                        : 'bg-secondary-text-color/40'
                      }`} />
                      <span className="min-w-0 truncate font-mono">{component.componentName}</span>
                      <span className="shrink-0 text-secondary-text-color/60">{component.status}</span>
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
                      <div key={i} className="flex min-w-0 items-center gap-1.5 text-secondary-text-color/80">
                        <GitBranch className="w-3 h-3 shrink-0" />
                        <span className="min-w-0 truncate font-mono">
                          {source.url}{source.rootDirectory ? ` / ${source.rootDirectory}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
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
                  <div key={c.name} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-border-color/50 px-3 py-2 text-xs">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      c.status === 'running' ? 'bg-success-color'
                      : c.status === 'starting' || c.status === 'building' ? 'bg-warning-color animate-pulse'
                      : c.status === 'failed' ? 'bg-danger-color'
                      : 'bg-secondary-text-color/40'
                    }`} />
                    <span className="min-w-0 max-w-[220px] truncate font-mono text-secondary-text-color/80">{c.name}</span>
                    {c.service && c.service !== c.name && (
                      <span className="min-w-0 max-w-[160px] truncate text-secondary-text-color/40">{c.service}</span>
                    )}
                    <span className={
                      c.status === 'running' ? 'shrink-0 text-success-color'
                      : c.status === 'starting' || c.status === 'building' ? 'shrink-0 text-warning-color'
                      : c.status === 'failed' ? 'shrink-0 text-danger-color'
                      : 'shrink-0 text-secondary-text-color/50'
                    }>{c.status}</span>
                    {c.health && (
                      <span className="shrink-0 text-secondary-text-color/40">health: {c.health}</span>
                    )}
                    <div className="ml-auto flex shrink-0 items-center gap-2">
                      {!isRemoved && (c.status === 'stopped' || c.status === 'failed') && (
                        <Tooltip label="컨테이너 시작">
                          <button
                            type="button"
                            onClick={() => { void handleContainerAction(c.name, 'start'); }}
                            className="p-0.5 text-secondary-text-color hover:text-primary-text-color transition-colors cursor-pointer focus-visible:outline-none focus-visible:text-primary-text-color"
                            aria-label="컨테이너 시작"
                          >
                            <Play className="w-3 h-3" />
                          </button>
                        </Tooltip>
                      )}
                      {!isRemoved && (c.status === 'running' || c.status === 'starting') && (
                        <Tooltip label="컨테이너 중지">
                          <button
                            type="button"
                            onClick={() => { void handleContainerAction(c.name, 'stop'); }}
                            className="p-0.5 text-secondary-text-color hover:text-primary-text-color transition-colors cursor-pointer focus-visible:outline-none focus-visible:text-primary-text-color"
                            aria-label="컨테이너 중지"
                          >
                            <Square className="w-3 h-3" />
                          </button>
                        </Tooltip>
                      )}
                      {!isRemoved && c.status === 'running' && (
                        <Tooltip label="컨테이너 재시작">
                          <button
                            type="button"
                            onClick={() => { void handleContainerAction(c.name, 'restart'); }}
                            className="p-0.5 text-secondary-text-color hover:text-primary-text-color transition-colors cursor-pointer focus-visible:outline-none focus-visible:text-primary-text-color"
                            aria-label="컨테이너 재시작"
                          >
                            <RefreshCw className="w-3 h-3" />
                          </button>
                        </Tooltip>
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
            onClear={clearLogs}
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
