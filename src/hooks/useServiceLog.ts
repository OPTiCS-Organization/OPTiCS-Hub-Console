import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { ContainerCounts, ContainerState, ServiceItem } from "../interfaces/ServiceItem.interface";

export interface LogEntry {
  serviceIndex: number;
  log: string;
  timestamp: string;
  sessionId: number;
  type?: 'log' | 'marker';
  markerEvent?: string;
  containerName?: string;
  source?: 'hub' | 'agent' | 'runtime';
  stream?: 'deploy' | 'lifecycle' | 'runtime';
  composeService?: string;
  stderr?: boolean;
}

export interface LogLoadProgress {
  serviceIndex: number;
  loaded: number;
  total: number;
  percent: number;
  phase: 'loading' | 'streaming' | 'complete';
}

interface LogHistoryPayload {
  serviceIndex: number;
  logs: {
    line: string;
    timestamp?: string;
    source?: 'hub' | 'agent' | 'runtime';
    stream?: 'deploy' | 'lifecycle' | 'runtime';
    containerName?: string;
    composeService?: string;
    stderr?: boolean;
  }[];
  markers?: LogSessionMarker[];
  before?: string;
  hasMore?: boolean;
}

interface LogMarkersPayload {
  serviceIndex: number;
  markers: LogSessionMarker[];
}

interface LogSessionMarker {
  serviceIndex: number;
  serviceName: string;
  containerName: string;
  event: string;
  timestamp: string;
}

const MAX_LOG_ENTRIES = 20000;
const SERVICE_SESSION_MARKER_EVENTS = new Set(['service-deploy', 'service-redeploy', 'service-start']);

function logTime(entry: Pick<LogEntry, 'timestamp'>): number {
  const time = new Date(entry.timestamp).getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}

function mergeLogs(current: LogEntry[], incoming: LogEntry[]): LogEntry[] {
  const merged = new Map<string, LogEntry>();

  [...current, ...incoming].forEach((entry) => {
    merged.set(`${entry.type ?? 'log'}:${entry.timestamp}:${entry.source ?? ''}:${entry.stream ?? ''}:${entry.containerName ?? ''}:${entry.composeService ?? ''}:${entry.markerEvent ?? ''}:${entry.log}`, entry);
  });

  return assignLogSessions(
    Array.from(merged.values())
      .sort((a, b) => logTime(a) - logTime(b))
      .slice(-MAX_LOG_ENTRIES),
  );
}

function earliestTimestamp(logs: LogEntry[]): string | null {
  const sorted = [...logs].sort((a, b) => logTime(a) - logTime(b));
  return sorted[0]?.timestamp ?? null;
}

function markerToLogEntry(marker: LogSessionMarker): LogEntry {
  return {
    serviceIndex: marker.serviceIndex,
    log: `${marker.containerName} ${marker.event}`,
    timestamp: marker.timestamp,
    sessionId: 0,
    type: 'marker',
    markerEvent: marker.event,
    containerName: marker.containerName,
  };
}

function assignLogSessions(entries: LogEntry[]): LogEntry[] {
  let sessionId = 0;
  let hasAnyEntry = false;
  return entries.map((entry) => {
    if (entry.type === 'marker' && entry.markerEvent && SERVICE_SESSION_MARKER_EVENTS.has(entry.markerEvent) && hasAnyEntry) {
      sessionId += 1;
    }

    const nextEntry = { ...entry, sessionId };

    hasAnyEntry = true;

    return nextEntry;
  });
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
  const [logLoadProgress, setLogLoadProgress] = useState<LogLoadProgress | null>(null);
  const [isLoadingOlderLogs, setIsLoadingOlderLogs] = useState(false);
  const [hasOlderLogs, setHasOlderLogs] = useState(true);
  const sessionIdRef = useRef<number>(0);
  const isPrependingLogsRef = useRef<boolean>(false);
  const socketRef = useRef<Socket | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const lastLogSubscribeAtRef = useRef<number>(0);

  const serviceRef = useRef<ServiceItem | null>(service);
  useEffect(() => { serviceRef.current = service; }, [service]);

  const setServiceStatusRef = useRef<((status: ServiceItem['serviceStatus']) => void) | null>(null);

  const subscribeLog = useCallback((socket: Socket, initial: ServiceItem, currentWorkspaceIndex: number) => {
    const now = Date.now();
    if (now - lastLogSubscribeAtRef.current < 1000) return;
    lastLogSubscribeAtRef.current = now;

    socket.emit('subscribe-log', {
      workspaceIndex: currentWorkspaceIndex,
      agentUuid: initial.agentUuid,
      serviceIndex: Number(serviceIndex),
      serviceName: initial.serviceName,
      deployPreset: initial.serviceDeployPreset,
    });
  }, [serviceIndex]);

  useEffect(() => {
    if (!service || !serviceIndex || !workspaceIndex || !service.agentUuid) return;
    const initial = service;

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
      subscribeLog(socket, initial, workspaceIndex);
    });

    socket.on('service-log', (data: Omit<LogEntry, 'sessionId'>) => {
      if (data.serviceIndex !== Number(serviceIndex)) return;
      setLogs(prev => mergeLogs(prev, [{ ...data, sessionId: sessionIdRef.current, type: 'log' }]));
    });

    socket.on('service-log-history', (data: LogHistoryPayload) => {
      if (data.serviceIndex !== Number(serviceIndex)) return;
      const historyLogs: LogEntry[] = data.logs.map(entry => ({
        serviceIndex: data.serviceIndex,
        log: entry.line,
        timestamp: entry.timestamp ?? data.before ?? new Date().toISOString(),
        sessionId: sessionIdRef.current,
        type: 'log',
        source: entry.source,
        stream: entry.stream,
        containerName: entry.containerName,
        composeService: entry.composeService,
        stderr: entry.stderr,
      }));
      const markerLogs = (data.markers ?? []).filter(marker => SERVICE_SESSION_MARKER_EVENTS.has(marker.event)).map(markerToLogEntry);
      setLogs(prev => mergeLogs(prev, [...historyLogs, ...markerLogs]));
      setHasOlderLogs(data.hasMore ?? historyLogs.length > 0);
      setIsLoadingOlderLogs(false);
      isPrependingLogsRef.current = false;
    });

    socket.on('service-log-markers', (data: LogMarkersPayload) => {
      if (data.serviceIndex !== Number(serviceIndex)) return;
      setLogs(prev => mergeLogs(prev, data.markers.filter(marker => SERVICE_SESSION_MARKER_EVENTS.has(marker.event)).map(markerToLogEntry)));
    });

    socket.on('log-load-progress', (data: LogLoadProgress) => {
      if (data.serviceIndex !== Number(serviceIndex)) return;
      setLogLoadProgress(data);
    });

    socket.on('service-status', (data: { serviceIndex: number; status: ServiceItem['serviceStatus'] }) => {
      if (data.serviceIndex !== Number(serviceIndex)) return;
      setServiceStatusRef.current?.(data.status);
      if (data.status === 'running') {
        subscribeLog(socket, initial, workspaceIndex);
      }
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
  }, [serviceIndex, workspaceIndex, service?.agentUuid, service?.serviceName, service?.serviceDeployPreset, subscribeLog]);

  useEffect(() => {
    const maxSessionId = logs.reduce((max, entry) => Math.max(max, entry.sessionId), 0);
    sessionIdRef.current = maxSessionId;
    setCurrentSessionId(maxSessionId);
  }, [logs]);

  const loadOlderLogs = useCallback(() => {
    const initial = serviceRef.current;
    const socket = socketRef.current;
    if (!initial || !serviceIndex || !workspaceIndex || !initial.agentUuid || !socket) return;
    if (isLoadingOlderLogs || !hasOlderLogs || logs.length === 0) return;

    const before = earliestTimestamp(logs);
    if (!before) return;

    isPrependingLogsRef.current = true;
    setIsLoadingOlderLogs(true);
    socket.emit('command', {
      workspaceIndex,
      agentUuid: initial.agentUuid,
      command: 'LOAD_OLDER_LOG',
      serviceIndex: Number(serviceIndex),
      serviceName: initial.serviceName,
      deployPreset: initial.serviceDeployPreset,
      before,
      limit: 1000,
    });
  }, [hasOlderLogs, isLoadingOlderLogs, logs, serviceIndex, workspaceIndex]);

  return {
    logs,
    setLogs,
    expandedSessions,
    setExpandedSessions,
    currentSessionId,
    containers,
    containerCounts,
    logLoadProgress,
    isLoadingOlderLogs,
    hasOlderLogs,
    loadOlderLogs,
    logEndRef,
    onServiceStatusChangeRef: setServiceStatusRef,
  };
}
