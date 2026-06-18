import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, GitBranch, Globe, Package, Pencil, Play, Square, RefreshCw, Trash2, X } from "lucide-react";
import { apiFetch } from "../lib/apiFetch";
import { useAuth } from "../context/Auth.context";
import { useModal } from "../context/Modal.context";
import { useWorkspace } from "../context/Workspace.context";
import { useServiceLog } from "../hooks/useServiceLog";
import { statusDot, statusLabel, presetLabel } from "../constants/service";
import type { ServiceItem } from "../interfaces/ServiceItem.interface";
import ServiceForm from "../components/service/ServiceForm";
import LogPanel from "../components/service/LogPanel";

type TabKey = 'overview' | 'containers' | 'logs';

const SERVICE_DOMAIN = import.meta.env.VITE_SERVICE_DOMAIN as string;

// 서브도메인 → 접속 가능한 전체 URL (예: hwplace → https://hwplace.service.optics.run/)
function buildServiceUrl(subdomain: string): string {
  return `https://${subdomain}.${SERVICE_DOMAIN}/`;
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-2.5 border-b border-border-color/40 last:border-0">
      <span className="w-24 shrink-0 text-xs text-secondary-text-color/70">{label}</span>
      <div className="min-w-0 flex-1 text-xs text-primary-text-color">{children}</div>
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
      const res = await apiFetch(`/v1/workspace/${currentWorkspace.workspaceIndex}/services`, {}, logout);
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
        <button onClick={() => navigate('/services')} className="flex items-center gap-1.5 text-xs text-secondary-text-color hover:text-primary-text-color transition-colors cursor-pointer">
          <ArrowLeft className="w-3 h-3" />
          목록으로
        </button>
      </div>
    );
  }
  const isRemoved = service.serviceStatus === 'removed';

  async function handleStartService() {
    try {
      const res = await apiFetch(`/v1/workspace/services/${serviceIndex}/start`, { method: 'POST' }, logout);
      if (!res.ok) console.log(await res.json());
    } catch (error) {
      console.log(error);
    }
  }

  async function handleStopService() {
    try {
      const res = await apiFetch(`/v1/workspace/services/${serviceIndex}/stop`, { method: 'POST' }, logout);
      if (!res.ok) console.log(await res.json());
    } catch (error) {
      console.log(error);
    }
  }

  async function handleContainerAction(containerName: string, action: 'start' | 'stop' | 'restart') {
    if (!serviceIndex) return;
    try {
      const res = await apiFetch(`/v1/workspace/services/${serviceIndex}/containers/${encodeURIComponent(containerName)}/${action}`, { method: 'POST' }, logout);
      if (!res.ok) console.log(await res.json());
    } catch (error) {
      console.log(error);
    }
  }

  async function handleSaveSubdomain() {
    const value = subdomainInput.trim();
    if (value !== '' && (value.length > 63 || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(value))) {
      setSubdomainError('소문자/숫자/하이픈만 사용할 수 있습니다.');
      return;
    }
    try {
      const res = await apiFetch(`/v1/workspace/services/${serviceIndex}/subdomain`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain: value === '' ? null : value }),
      }, logout);
      if (!res.ok) {
        setSubdomainError(res.status === 409 ? '이미 사용 중인 서브도메인입니다.' : '저장에 실패했습니다.');
        return;
      }
      setService(prev => prev ? { ...prev, serviceSubdomain: value === '' ? null : value } : prev);
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
      const res = await apiFetch(`/v1/workspace/services/${serviceIndex}`, {
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

  const sourceUrls: string[] = (() => {
    if (!service.serviceSourceUrl) return [];
    try {
      const parsed = JSON.parse(service.serviceSourceUrl);
      return Array.isArray(parsed) ? parsed : [service.serviceSourceUrl];
    } catch {
      return [service.serviceSourceUrl];
    }
  })();

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: '개요' },
    { key: 'containers', label: containers.length > 0 ? `컨테이너 (${containers.length})` : '컨테이너' },
    { key: 'logs', label: '로그' },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden pt-20 text-primary-text-color">

      {/* 뒤로가기 */}
      <button
        onClick={() => navigate('/services')}
        className="mb-4 flex w-fit shrink-0 items-center gap-1.5 text-xs text-secondary-text-color hover:text-primary-text-color transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-3 h-3" />
        목록으로
      </button>

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
              <span className="font-mono">
                :{service.serviceHostPort ?? service.servicePort}
                {(service.serviceContainerPort ?? service.servicePort) !== (service.serviceHostPort ?? service.servicePort)
                  ? ` -> :${service.serviceContainerPort ?? service.servicePort}`
                  : ''}
              </span>
            </InfoRow>
            <InfoRow label="에이전트">
              {service.agentName ?? <span className="text-secondary-text-color/50">미연결</span>}
            </InfoRow>
            <InfoRow label="소스">
              {sourceUrls.length === 0
                ? <span className="text-secondary-text-color/50">없음</span>
                : (
                  <div className="flex flex-col gap-0.5">
                    {sourceUrls.map((url, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-secondary-text-color/80">
                        <GitBranch className="w-3 h-3 shrink-0" />
                        <span className="font-mono truncate">{url}</span>
                      </div>
                    ))}
                  </div>
                )}
            </InfoRow>
            {service.serviceRootDirectory && (
              <InfoRow label="루트 디렉터리">
                <span className="font-mono">{service.serviceRootDirectory}</span>
              </InfoRow>
            )}
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
                      placeholder="subdomain"
                      autoFocus
                      className="w-40 rounded border border-border-color bg-transparent px-1.5 py-0.5 font-mono text-xs text-primary-text-color outline-none focus:border-service-color"
                    />
                    <Check className="w-3 h-3 cursor-pointer text-secondary-text-color hover:text-green-400 transition-colors" onClick={() => { void handleSaveSubdomain(); }} />
                    <X className="w-3 h-3 cursor-pointer text-secondary-text-color hover:text-red-400 transition-colors" onClick={() => { setSubdomainEditing(false); setSubdomainError(null); }} />
                  </>
                ) : (
                  <>
                    {service.serviceSubdomain ? (
                      <a
                        href={buildServiceUrl(service.serviceSubdomain)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-service-color hover:underline truncate"
                      >
                        {buildServiceUrl(service.serviceSubdomain)}
                      </a>
                    ) : (
                      <span className="font-mono text-secondary-text-color/50">미설정</span>
                    )}
                    {!isRemoved && (
                      <Pencil
                        className="w-3 h-3 shrink-0 cursor-pointer text-secondary-text-color/60 hover:text-primary-text-color transition-colors"
                        onClick={() => { setSubdomainInput(service.serviceSubdomain ?? ''); setSubdomainEditing(true); }}
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
