import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { ServiceItem } from "../interfaces/ServiceItem.interface";

export interface LogEntry {
  serviceIndex: number;
  log: string;
  timestamp: string;
  sessionId: number;
}

export function useServiceLog(
  service: ServiceItem | null,
  serviceIndex: string | undefined,
) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [expandedSessions, setExpandedSessions] = useState<Set<number>>(new Set());
  const [currentSessionId, setCurrentSessionId] = useState<number>(0);
  const sessionIdRef = useRef<number>(0);
  const socketRef = useRef<Socket | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const serviceRef = useRef<ServiceItem | null>(service);
  useEffect(() => { serviceRef.current = service; }, [service]);

  const setServiceStatusRef = useRef<((status: ServiceItem['serviceStatus']) => void) | null>(null);

  useEffect(() => {
    if (!serviceRef.current || !serviceIndex || !serviceRef.current.agentCode) return;
    const initial = serviceRef.current;

    const socket: Socket = io(`${import.meta.env.VITE_API_URL}/console`, {
      transports: ['websocket'],
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('subscribe-log', {
        agentCode: initial.agentCode,
        serviceIndex: Number(serviceIndex),
        serviceName: initial.serviceName,
        deployPreset: initial.serviceDeployPreset,
      });
    });

    socket.on('service-log', (data: Omit<LogEntry, 'sessionId'>) => {
      if (data.serviceIndex !== Number(serviceIndex)) return;
      setLogs(prev => [...prev, { ...data, sessionId: sessionIdRef.current }].slice(-1000));
    });

    socket.on('service-status', (data: { serviceIndex: number; status: ServiceItem['serviceStatus'] }) => {
      if (data.serviceIndex !== Number(serviceIndex)) return;
      if (data.status === 'building') setLogs([]);
      if (data.status === 'running') {
        sessionIdRef.current += 1;
        setCurrentSessionId(sessionIdRef.current);
        socket.emit('subscribe-log', {
          agentCode: initial.agentCode,
          serviceIndex: Number(serviceIndex),
          serviceName: initial.serviceName,
          deployPreset: initial.serviceDeployPreset,
        });
      }
      setServiceStatusRef.current?.(data.status);
    });

    return () => {
      const cur = serviceRef.current;
      socket.emit('unsubscribe-log', {
        agentCode: cur?.agentCode ?? initial.agentCode,
        serviceName: cur?.serviceName ?? initial.serviceName,
      });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [serviceIndex]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return {
    logs,
    setLogs,
    expandedSessions,
    setExpandedSessions,
    currentSessionId,
    logEndRef,
    onServiceStatusChangeRef: setServiceStatusRef,
  };
}
