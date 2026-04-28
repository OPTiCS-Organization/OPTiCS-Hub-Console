import { useCallback, useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, GitBranch, Package, Play, Square, RefreshCw, Trash2 } from "lucide-react";
import { apiFetch } from "../lib/apiFetch";
import { useAuth } from "../context/Auth.context";
import { useModal } from "../context/Modal.context";
import { useWorkspace } from "../context/Workspace.context";
import { useServiceLog } from "../hooks/useServiceLog";
import { statusDot, statusLabel, presetLabel } from "../constants/service";
import type { ServiceItem } from "../interfaces/ServiceItem.interface";
import ServiceForm from "../components/service/ServiceForm";
import LogPanel from "../components/service/LogPanel";

export default function ServiceDetail() {
  const { serviceIndex } = useParams<{ serviceIndex: string }>();
  const { state } = useLocation() as { state: { service: ServiceItem } | null };
  const navigate = useNavigate();

  const [service, setService] = useState<ServiceItem | null>(state?.service ?? null);
  const [serviceLoading, setServiceLoading] = useState(!state?.service);
  const { logout } = useAuth();
  const { openModal } = useModal();
  const { currentWorkspace } = useWorkspace();

  const {
    logs, setLogs,
    expandedSessions, setExpandedSessions,
    currentSessionId,
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

  async function handleDeleteService() {
    if (!service || !confirm(`'${service.serviceName}' 서비스를 삭제하시겠습니까?`)) return;
    try {
      const res = await apiFetch(`/v1/workspace/services/${serviceIndex}`, { method: 'DELETE' }, logout);
      if (res.ok) navigate('/services');
      else console.log(await res.json());
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
            {service.agentName && (
              <>
                <span className="text-secondary-text-color/40">·</span>
                <span className="text-secondary-text-color/70">{service.agentName}</span>
              </>
            )}
          </div>
          {service.serviceSourceUrl && (() => {
            let urls: string[];
            try { const p = JSON.parse(service.serviceSourceUrl); urls = Array.isArray(p) ? p : [service.serviceSourceUrl]; }
            catch { urls = [service.serviceSourceUrl]; }
            return (
              <div className="flex flex-col gap-0.5 mt-1">
                {urls.map((url, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-secondary-text-color/60">
                    <GitBranch className="w-3 h-3 shrink-0" />
                    <span className="font-mono truncate">{url}</span>
                  </div>
                ))}
              </div>
            );
          })()}
          <div className="mt-1 flex items-center gap-3">
            <Play className="w-4 h-4 cursor-pointer text-secondary-text-color hover:text-primary-text-color transition-colors" onClick={() => handleStartService()} />
            <Square className="w-4 h-4 cursor-pointer text-secondary-text-color hover:text-red-400 transition-colors" onClick={() => handleStopService()} />
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
      </div>

      {/* 로그 패널 */}
      <LogPanel
        logs={logs}
        currentSessionId={currentSessionId}
        expandedSessions={expandedSessions}
        setExpandedSessions={setExpandedSessions}
        onClear={() => setLogs([])}
        logEndRef={logEndRef}
      />

    </div>
  );
}
