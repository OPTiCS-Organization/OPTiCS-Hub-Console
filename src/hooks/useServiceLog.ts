import { startTransition, useCallback, useEffect, useRef, useState } from "react";
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

// 라이브 스트리밍만으로 유지하는 기본 버퍼 상한.
const MAX_LOG_ENTRIES = 20000;
// '이전 로그 불러오기'로 사용자가 명시적으로 넓힐 수 있는 절대 상한.
const MAX_LOG_ENTRIES_HARD = 60000;
// 라이브 로그를 모아 두었다가 한 번에 반영하는 주기(ms). 줄마다 렌더하지 않기 위한 것.
const LOG_FLUSH_INTERVAL_MS = 80;
const SERVICE_SESSION_MARKER_EVENTS = new Set(['service-deploy', 'service-redeploy', 'service-start']);

function logTime(entry: Pick<LogEntry, 'timestamp'>): number {
  const time = new Date(entry.timestamp).getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}

// 같은 줄이 히스토리와 스트림 양쪽으로 들어와도 하나만 남기기 위한 중복 판정 키.
// 버퍼 안에서 유일함이 보장되므로 렌더 시 React key로도 그대로 쓴다.
export function logKey(entry: LogEntry): string {
  return `${entry.type ?? 'log'}:${entry.timestamp}:${entry.source ?? ''}:${entry.stream ?? ''}:${entry.containerName ?? ''}:${entry.composeService ?? ''}:${entry.markerEvent ?? ''}:${entry.log}`;
}

// 정렬된 버퍼에서 time이 들어갈 위치를 이진 탐색으로 찾는다.
// 늦게 도착한 줄 하나 때문에 전체를 다시 정렬하지 않으려는 용도다.
function insertIndex(entries: LogEntry[], time: number): number {
  let low = 0;
  let high = entries.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (logTime(entries[mid]) <= time) low = mid + 1;
    else high = mid;
  }
  return low;
}

// 이미 정렬된 버퍼 뒤에 새 줄을 이어 붙인다. 순서가 뒤집힌 줄만 제자리에 끼워 넣는다.
// 비용이 버퍼 크기가 아니라 새로 추가된 줄 수에 비례하는 것이 핵심이다.
function appendEntries(current: LogEntry[], incoming: LogEntry[]): LogEntry[] {
  const next = current.slice();
  incoming.forEach((entry) => {
    const time = logTime(entry);
    if (next.length === 0 || time >= logTime(next[next.length - 1])) next.push(entry);
    else next.splice(insertIndex(next, time), 0, entry);
  });
  return next;
}

// 순서를 보장할 수 없는 묶음(히스토리·마커)을 받을 때만 쓰는 전량 머지.
// 비용이 버퍼 크기에 비례하므로 라이브 스트리밍 경로에서는 절대 쓰지 않는다.
function mergeLogs(current: LogEntry[], incoming: LogEntry[]): { entries: LogEntry[]; keys: Set<string> } {
  const merged = new Map<string, LogEntry>();

  [...current, ...incoming].forEach((entry) => {
    const key = logKey(entry);
    // 먼저 들어온 쪽을 남긴다. 내용이 같은 중복이라 어느 쪽이든 같지만,
    // 객체 참조가 유지돼야 memo된 로그 줄이 헛되이 다시 그려지지 않는다.
    if (!merged.has(key)) merged.set(key, entry);
  });

  return {
    entries: Array.from(merged.values()).sort((a, b) => logTime(a) - logTime(b)),
    keys: new Set(merged.keys()),
  };
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

    // 세션이 그대로면 같은 객체를 재사용한다. 새 객체를 만들면 memo된 줄이 전부 다시 그려진다.
    const nextEntry = entry.sessionId === sessionId ? entry : { ...entry, sessionId };

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
  const loadingOlderLogsRef = useRef<boolean>(false);
  const hasOlderLogsRef = useRef<boolean>(true);
  const lastOlderBeforeRef = useRef<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const lastLogSubscribeAtRef = useRef<number>(0);

  // logs state와 항상 같은 값을 들고 있는 ref. 소켓 핸들러가 setState 콜백 없이
  // 현재 버퍼를 바로 읽을 수 있어야 loadOlderLogs 같은 콜백을 logs 의존성 없이 고정할 수 있다.
  const logsRef = useRef<LogEntry[]>([]);
  const logKeysRef = useRef<Set<string>>(new Set());
  const capacityRef = useRef<number>(MAX_LOG_ENTRIES);
  const pendingLogsRef = useRef<LogEntry[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const serviceRef = useRef<ServiceItem | null>(service);
  useEffect(() => { serviceRef.current = service; }, [service]);

  const setServiceStatusRef = useRef<((status: ServiceItem['serviceStatus']) => void) | null>(null);

  // 버퍼를 상한에 맞춰 자르고 ref와 state를 한 번에 갱신한다.
  // keep은 어느 쪽을 남길지다. 과거 로그를 막 불러온 직후에는 'head'라야 그 줄들이 살아남는다.
  const commitLogs = useCallback((next: LogEntry[], keys: Set<string>, keep: 'head' | 'tail'): LogEntry[] => {
    const capacity = capacityRef.current;

    // next는 호출자가 방금 만든 배열이라 아직 아무도 참조하지 않는다.
    // 그래서 새 배열을 또 뜨지 않고 제자리에서 잘라낸다. 줄마다 20000칸 복사가 한 번 줄어든다.
    if (next.length > capacity) {
      const dropCount = next.length - capacity;
      const dropped = keep === 'tail' ? next.splice(0, dropCount) : next.splice(capacity, dropCount);
      dropped.forEach(entry => keys.delete(logKey(entry)));
    }

    logsRef.current = next;
    logKeysRef.current = keys;
    setLogs(next);
    return next;
  }, []);

  // 모아 둔 라이브 로그를 한 번에 버퍼 끝에 붙인다.
  // 세션 경계는 마커에서만 생기고 마커는 이 경로로 오지 않으므로 세션 재계산이 필요 없다.
  const flushPendingLogs = useCallback(() => {
    if (flushTimerRef.current !== null) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }

    const pending = pendingLogsRef.current;
    if (pending.length === 0) return;
    pendingLogsRef.current = [];

    const current = logsRef.current;
    const keys = logKeysRef.current;
    const sessionId = current.length > 0 ? current[current.length - 1].sessionId : 0;
    const accepted: LogEntry[] = [];

    pending.forEach((entry) => {
      const key = logKey(entry);
      if (keys.has(key)) return;
      keys.add(key);
      accepted.push(entry.sessionId === sessionId ? entry : { ...entry, sessionId });
    });

    if (accepted.length === 0) return;
    commitLogs(appendEntries(current, accepted), keys, 'tail');
  }, [commitLogs]);

  // 라이브 로그 한 줄을 대기열에 넣고 플러시를 예약한다.
  // 줄마다 setState하면 초당 수십 번 렌더가 돌기 때문에 짧게 모아서 반영한다.
  const queueLogEntry = useCallback((entry: LogEntry) => {
    pendingLogsRef.current.push(entry);
    if (flushTimerRef.current === null) {
      flushTimerRef.current = setTimeout(flushPendingLogs, LOG_FLUSH_INTERVAL_MS);
    }
  }, [flushPendingLogs]);

  const updateHasOlderLogs = useCallback((value: boolean) => {
    hasOlderLogsRef.current = value;
    setHasOlderLogs(value);
  }, []);

  const clearLogs = useCallback(() => {
    if (flushTimerRef.current !== null) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    pendingLogsRef.current = [];
    logKeysRef.current = new Set();
    capacityRef.current = MAX_LOG_ENTRIES;
    logsRef.current = [];
    lastOlderBeforeRef.current = null;
    setLogs([]);
  }, []);

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
      queueLogEntry({ ...data, sessionId: sessionIdRef.current, type: 'log' });
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
      const isPrepending = isPrependingLogsRef.current;

      // 불러온 과거 로그만큼 버퍼 상한을 넓힌다. 넓히지 않으면 상한에 걸려
      // 방금 받은 과거 줄이 그대로 잘려 나가고, 스크롤을 올려도 아무 일도 일어나지 않는다.
      if (isPrepending) {
        capacityRef.current = Math.min(
          MAX_LOG_ENTRIES_HARD,
          Math.max(capacityRef.current, logsRef.current.length + historyLogs.length + markerLogs.length),
        );
      }

      // 대기 중인 라이브 줄을 먼저 비워야 전량 머지가 그 줄들을 빠뜨리지 않는다.
      flushPendingLogs();

      const applyMerge = () => {
        const { entries, keys } = mergeLogs(logsRef.current, [...historyLogs, ...markerLogs]);
        commitLogs(assignLogSessions(entries), keys, isPrepending ? 'head' : 'tail');
      };
      // 과거 로그 prepend는 스크롤 위치 보정과 동기화돼야 하므로 즉시 반영하고,
      // 초기 히스토리 대량 머지는 transition으로 낮춰 로딩 중 UI 입력이 막히지 않게 한다.
      if (isPrepending) applyMerge();
      else startTransition(applyMerge);

      updateHasOlderLogs(data.hasMore ?? historyLogs.length > 0);
      setIsLoadingOlderLogs(false);
      loadingOlderLogsRef.current = false;
      isPrependingLogsRef.current = false;
    });

    socket.on('service-log-markers', (data: LogMarkersPayload) => {
      if (data.serviceIndex !== Number(serviceIndex)) return;
      const markerLogs = data.markers.filter(marker => SERVICE_SESSION_MARKER_EVENTS.has(marker.event)).map(markerToLogEntry);
      if (markerLogs.length === 0) return;

      flushPendingLogs();
      const { entries, keys } = mergeLogs(logsRef.current, markerLogs);
      commitLogs(assignLogSessions(entries), keys, 'tail');
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
      loadingOlderLogsRef.current = false;
      lastOlderBeforeRef.current = null;
      if (flushTimerRef.current !== null) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      pendingLogsRef.current = [];
    };
  }, [serviceIndex, workspaceIndex, service?.agentUuid, service?.serviceName, service?.serviceDeployPreset, subscribeLog, queueLogEntry, flushPendingLogs, commitLogs, updateHasOlderLogs]);

  // 버퍼는 시간순이고 sessionId는 그 순서로 단조 증가하므로 마지막 줄이 곧 최대값이다.
  useEffect(() => {
    const maxSessionId = logs.length > 0 ? logs[logs.length - 1].sessionId : 0;
    sessionIdRef.current = maxSessionId;
    setCurrentSessionId(maxSessionId);
  }, [logs]);

  const loadOlderLogs = useCallback(() => {
    const initial = serviceRef.current;
    const socket = socketRef.current;
    const currentLogs = logsRef.current;
    if (!initial || !serviceIndex || !workspaceIndex || !initial.agentUuid || !socket) return;
    if (loadingOlderLogsRef.current || !hasOlderLogsRef.current || currentLogs.length === 0) return;

    // 버퍼가 시간순으로 유지되므로 첫 줄이 곧 가장 오래된 줄이다.
    const before = currentLogs[0].timestamp;
    if (!before) return;
    if (lastOlderBeforeRef.current === before) return;

    loadingOlderLogsRef.current = true;
    lastOlderBeforeRef.current = before;
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
  }, [serviceIndex, workspaceIndex]);

  return {
    logs,
    clearLogs,
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
