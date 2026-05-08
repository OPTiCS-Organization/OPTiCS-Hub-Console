import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { ContainerCounts, ContainerState, ServiceItem } from "../interfaces/ServiceItem.interface";

export interface LogEntry {
  serviceIndex: number;
  log: string;
  timestamp: string;
  sessionId: number;
}

export function useServiceLog(
  service: ServiceItem | null,
  serviceIndex: string | undefined,
  workspaceIndex: number | undefined,
) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [expandedSessions, setExpandedSessions] = useState<Set<number>>(new Set());
  const [currentSessionId, setCurrentSessionId] = useState<number>(0);
  const [containers, setContainers] = useState<ContainerState[]>([]);
  const [containerCounts, setContainerCounts] = useState<ContainerCounts | null>(null);
  const sessionIdRef = useRef<number>(0);
  const nextLogStartsNewSessionRef = useRef<boolean>(false);
  const socketRef = useRef<Socket | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const serviceRef = useRef<ServiceItem | null>(service);
  useEffect(() => { serviceRef.current = service; }, [service]);

  const setServiceStatusRef = useRef<((status: ServiceItem['serviceStatus']) => void) | null>(null);

  useEffect(() => {
    if (!service || !serviceIndex || !workspaceIndex || !service.agentUuid) return;
    const initial = service;
    const terminalStatuses: ServiceItem['serviceStatus'][] = ['stopped', 'failed', 'removed'];

    const socket: Socket = io(`${import.meta.env.VITE_API_URL}/console`, {
      transports: ['websocket'],
      reconnection: true,
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('subscribe-workspace', { workspaceIndex });
      socket.emit('command', {
        workspaceIndex,
        agentUuid: initial.agentUuid,
        command: 'SYNC_CONTAINER_STATUS',
        serviceIndex: Number(serviceIndex),
        serviceName: initial.serviceName,
        deployPreset: initial.serviceDeployPreset,
      });
      socket.emit('subscribe-log', {
        workspaceIndex,
        agentUuid: initial.agentUuid,
        serviceIndex: Number(serviceIndex),
        serviceName: initial.serviceName,
        deployPreset: initial.serviceDeployPreset,
      });
    });

    socket.on('service-log', (data: Omit<LogEntry, 'sessionId'>) => {
      if (data.serviceIndex !== Number(serviceIndex)) return;
      if (nextLogStartsNewSessionRef.current) {
        sessionIdRef.current += 1;
        setCurrentSessionId(sessionIdRef.current);
        nextLogStartsNewSessionRef.current = false;
      }
      setLogs(prev => [...prev, { ...data, sessionId: sessionIdRef.current }].slice(-1000));
    });

    socket.on('service-status', (data: { serviceIndex: number; status: ServiceItem['serviceStatus'] }) => {
      if (data.serviceIndex !== Number(serviceIndex)) return;
      if (terminalStatuses.includes(data.status)) {
        nextLogStartsNewSessionRef.current = true;
      }
      setServiceStatusRef.current?.(data.status);
    });

    socket.on('container-status', (data: { serviceIndex: number; containers: ContainerState[]; counts?: ContainerCounts }) => {
      if (data.serviceIndex !== Number(serviceIndex)) return;
      setContainers(data.containers);
      setContainerCounts(data.counts ?? {
        running: data.containers.filter(container => container.status === 'running').length,
        total: data.containers.length,
      });
    });

    return () => {
      socket.emit('unsubscribe-log', {
        workspaceIndex,
        agentUuid: initial.agentUuid,
        serviceName: initial.serviceName,
      });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [serviceIndex, workspaceIndex, service?.agentUuid, service?.serviceName, service?.serviceDeployPreset]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return {
    logs,
    setLogs,
    expandedSessions,
    setExpandedSessions,
    currentSessionId,
    containers,
    containerCounts,
    logEndRef,
    onServiceStatusChangeRef: setServiceStatusRef,
  };
}
