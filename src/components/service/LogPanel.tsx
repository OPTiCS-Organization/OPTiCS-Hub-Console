import { useLayoutEffect, useRef } from "react";
import { Terminal } from "lucide-react";
import type { LogEntry, LogLoadProgress } from "../../hooks/useServiceLog";

function formatTimestamp(timestamp: string): string {
  const d = new Date(timestamp);
  const ampm = d.getHours() < 12 ? 'AM' : 'PM';
  const h = String(d.getHours() % 12 || 12).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${ampm} ${h}:${m}:${s}`;
}

function markerLabel(entry: LogEntry): string {
  const labels: Record<string, string> = {
    'service-deploy': '서비스 배포',
    'service-redeploy': '서비스 재배포',
    'service-start': '서비스 시작',
    running: '컨테이너 시작',
    stopped: '컨테이너 중지',
    failed: '컨테이너 실패',
    removed: '컨테이너 제거',
  };
  return `${labels[entry.markerEvent ?? ''] ?? '컨테이너 이벤트'} · ${entry.containerName ?? '-'}`;
}

function logTags(entry: LogEntry): string[] {
  const tags: string[] = [];

  if (entry.source) {
    tags.push(entry.source);
  }
  if (entry.stream && entry.stream !== entry.source) {
    tags.push(entry.stream);
  }
  if (tags.length < 2 && entry.composeService) tags.push(entry.composeService);

  return tags.slice(0, 2);
}

function renderLogLine(entry: LogEntry, muted = false) {
  const tags = logTags(entry);
  const isError = entry.stderr || entry.log.startsWith('ERROR');
  return (
    <>
      <span className={muted ? "text-secondary-text-color/60 shrink-0" : "text-secondary-text-color/40 shrink-0"}>
        {formatTimestamp(entry.timestamp)}
      </span>
      {tags.length > 0 && (
        <span className="flex gap-1 shrink-0">
          {tags.map(tag => (
            <span key={tag} className="px-1 py-px rounded border border-border-color text-secondary-text-color/60 text-[9px] leading-4">
              {tag}
            </span>
          ))}
        </span>
      )}
      <span className={isError ? 'text-red-400' : 'text-primary-text-color'}>{entry.log}</span>
    </>
  );
}

interface LogPanelProps {
  logs: LogEntry[];
  currentSessionId: number;
  expandedSessions: Set<number>;
  setExpandedSessions: React.Dispatch<React.SetStateAction<Set<number>>>;
  onClear: () => void;
  logEndRef: React.RefObject<HTMLDivElement | null>;
  logLoadProgress: LogLoadProgress | null;
  isLoadingOlderLogs: boolean;
  hasOlderLogs: boolean;
  onLoadOlder: () => void;
}

export default function LogPanel({
  logs,
  currentSessionId,
  expandedSessions,
  setExpandedSessions,
  onClear,
  logEndRef,
  logLoadProgress,
  isLoadingOlderLogs,
  hasOlderLogs,
  onLoadOlder,
}: LogPanelProps) {
  const sessions = Array.from(new Set(logs.map(e => e.sessionId))).sort((a, b) => a - b);
  const isLoadingHistory = logLoadProgress?.phase === 'loading' && logLoadProgress.percent < 100;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const previousScrollHeightRef = useRef<number | null>(null);
  const shouldStickToBottomRef = useRef(true);

  useLayoutEffect(() => {
    const container = scrollRef.current;
    const previousScrollHeight = previousScrollHeightRef.current;
    if (!container) return;

    if (previousScrollHeight !== null) {
      container.scrollTop = container.scrollHeight - previousScrollHeight;
      previousScrollHeightRef.current = null;
      return;
    }

    if (shouldStickToBottomRef.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [logs.length]);

  useLayoutEffect(() => {
    if (!isLoadingOlderLogs && previousScrollHeightRef.current !== null) {
      previousScrollHeightRef.current = null;
    }
  }, [isLoadingOlderLogs]);

  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container) return;

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom < 40;

    if (isLoadingOlderLogs || !hasOlderLogs || logs.length === 0) return;
    if (container.scrollTop > 12) return;

    previousScrollHeightRef.current = container.scrollHeight;
    onLoadOlder();
  };

  return (
    <div className="border border-border-color rounded-md bg-modal-box-color flex flex-col" style={{ height: 'calc(100vh - 320px)', minHeight: '300px' }}>
      <div className="px-4 py-2.5 border-b border-border-color flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-secondary-text-color" />
          <span className="text-xs font-semibold text-primary-text-color">로그</span>
          <span className="w-1.5 h-1.5 rounded-full bg-service-color animate-pulse" />
          {logLoadProgress && (
            <span className="text-[10px] text-secondary-text-color/60">
              {isLoadingHistory
                ? `불러오는 중 ${logLoadProgress.percent}% (${logLoadProgress.loaded}/${logLoadProgress.total})`
                : 'Streaming'}
            </span>
          )}
        </div>
        <button
          onClick={onClear}
          className="text-[10px] text-secondary-text-color hover:text-primary-text-color transition-colors cursor-pointer"
        >
          지우기
        </button>
      </div>
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-5">
        {isLoadingOlderLogs && (
          <div className="text-center text-secondary-text-color/50 text-[10px] py-1">
            이전 로그 불러오는 중...
          </div>
        )}
        {!hasOlderLogs && logs.length > 0 && (
          <div className="text-center text-secondary-text-color/30 text-[10px] py-1">
            더 이상 불러올 로그가 없습니다
          </div>
        )}
        {logs.length === 0
          ? <span className="text-secondary-text-color/40">로그 대기 중...</span>
          : sessions.map(sid => {
            const sessionLogs = logs.filter(e => e.sessionId === sid);
            const isCurrent = sid === currentSessionId;
            const isExpanded = expandedSessions.has(sid);

            if (!isCurrent) {
              return (
                <div key={sid} className="mb-1">
                  <button
                    onClick={() => setExpandedSessions(prev => {
                      const next = new Set(prev);
                      next.has(sid) ? next.delete(sid) : next.add(sid);
                      return next;
                    })}
                    className="text-secondary-text-color/40 hover:text-secondary-text-color transition-colors cursor-pointer text-[10px] py-0.5"
                  >
                    {isExpanded ? '▾' : '▸'} 이전 세션 로그 {sessionLogs.length}줄
                  </button>
                  {isExpanded && sessionLogs.map((entry, i) => (
                    entry.type === 'marker'
                      ? (
                        <div key={i} className="flex items-center gap-2 opacity-50 py-0.5">
                          <span className="text-secondary-text-color/60 shrink-0">{formatTimestamp(entry.timestamp)}</span>
                          <span className="h-px bg-border-color flex-1" />
                          <span className="text-secondary-text-color/70 text-[10px] shrink-0">{markerLabel(entry)}</span>
                          <span className="h-px bg-border-color flex-1" />
                        </div>
                      )
                      : <div key={i} className="flex gap-2 opacity-40">{renderLogLine(entry, true)}</div>
                  ))}
                </div>
              );
            }

            return sessionLogs.map((entry, i) => (
              entry.type === 'marker'
                ? (
                  <div key={`${sid}-${i}`} className="flex items-center gap-2 py-0.5">
                    <span className="text-secondary-text-color/40 shrink-0">{formatTimestamp(entry.timestamp)}</span>
                    <span className="h-px bg-border-color flex-1" />
                    <span className="text-secondary-text-color/70 text-[10px] shrink-0">{markerLabel(entry)}</span>
                    <span className="h-px bg-border-color flex-1" />
                  </div>
                )
                : <div key={`${sid}-${i}`} className="flex gap-2">{renderLogLine(entry)}</div>
            ));
          })
        }
        <div ref={logEndRef} />
      </div>
    </div>
  );
}
