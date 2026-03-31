import { useState, useEffect, useCallback } from "react";
import { Loader2, RefreshCw, Plus } from "lucide-react";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";

import { useWorkspace } from "../context/Workspace.context";
import { useAuth } from "../context/Auth.context";
import { useModal } from "../context/Modal.context";
import { apiFetch } from "../lib/apiFetch";
import type { ServiceItem } from "../interfaces/ServiceItem.interface";
import ServiceCard from "../components/service/ServiceCard";
import ServiceForm from "../components/service/ServiceForm";

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
    openModal('서비스 등록', <ServiceForm mode="create" workspaceIndex={currentWorkspace.workspaceIndex} onSuccess={() => { void fetchServices(); }} />);
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
