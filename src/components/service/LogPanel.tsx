import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, Loader2, Terminal } from "lucide-react";
import type { LogEntry, LogLoadProgress } from "../../hooks/useServiceLog";

// 현재 세션에서 한 번에 DOM에 그릴 최대 줄 수. 나머지는 "더보기"로 숨겨 초기 렌더 부하를 막는다.
const CURRENT_SESSION_RENDER_LIMIT = 1500;
const CURRENT_SESSION_RENDER_STEP = 3000;

// 우측 하단 안내 배지: 로딩 완료('loaded')는 현재 렌더 수, 더보기('shown')는 추가로 드러난 수를 보여준다.
type ToastState = { mode: 'loaded' } | { mode: 'shown'; added: number };

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
        <span className="flex gap-1 shrink-0 self-start">
          {tags.map(tag => (
            <span key={tag} className="inline-flex h-4 items-center px-1 rounded border border-border-color text-secondary-text-color/60 text-[9px] leading-none">
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
  // progress 이벤트가 오기 전(에이전트가 docker logs를 읽어 전체 크기를 재는 구간) → 측정 중
  const isMeasuring = !logLoadProgress;
  const isLoadingHistory = logLoadProgress?.phase === 'loading' && logLoadProgress.percent < 100;
  const loadingLabel = isMeasuring
    ? '로그 크기 측정 중...'
    : isLoadingHistory
      ? `로그 불러오는 중... ${logLoadProgress.percent}% (${logLoadProgress.loaded.toLocaleString()}/${logLoadProgress.total.toLocaleString()})`
      : null;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const previousScrollHeightRef = useRef<number | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const [currentVisibleCount, setCurrentVisibleCount] = useState(CURRENT_SESSION_RENDER_LIMIT);

  // 실제로 DOM에 렌더되는 로그(마커 제외) 수: 접힌 과거 세션은 제외하고, 현재 세션은 상한까지만 센다.
  const renderedLogCount = sessions.reduce((total, sid) => {
    const sessionLogs = logs.filter(entry => entry.sessionId === sid);
    const isCurrent = sid === currentSessionId;
    if (!isCurrent && !expandedSessions.has(sid)) return total;
    const visible = isCurrent && sessionLogs.length > currentVisibleCount
      ? sessionLogs.slice(-currentVisibleCount)
      : sessionLogs;
    return total + visible.reduce((n, entry) => entry.type === 'marker' ? n : n + 1, 0);
  }, 0);

  // 토스트: 로딩 완료 직후('loaded')나 더보기 클릭('shown') 시 잠깐 떴다가 5초 뒤 사라진다.
  const [toast, setToast] = useState<ToastState | null>(null);
  const wasLoadingRef = useRef(false);

  useEffect(() => {
    const loadingNow = isMeasuring || isLoadingHistory;
    if (wasLoadingRef.current && !loadingNow) setToast({ mode: 'loaded' });
    wasLoadingRef.current = loadingNow;
  }, [isMeasuring, isLoadingHistory]);

  // toast가 새 객체로 갱신될 때마다(완료/더보기) 5초 타이머를 재시작한다.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

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
    <div className="relative flex min-h-[300px] flex-1 flex-col overflow-hidden rounded-md border border-border-color bg-modal-box-color">
      <div className="px-4 py-2.5 border-b border-border-color flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-secondary-text-color" />
          <span className="text-xs font-semibold text-primary-text-color">로그</span>
          <span className="w-1.5 h-1.5 rounded-full bg-service-color animate-pulse" />
          <span className="text-[10px] text-secondary-text-color/60">
            {isMeasuring ? '크기 측정 중...' : isLoadingHistory ? `불러오는 중 ${logLoadProgress.percent}%` : 'Streaming'}
          </span>
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
          ? (!loadingLabel && <span className="text-[11px] text-secondary-text-color/40">로그 대기 중...</span>)
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

            const hiddenCount = sessionLogs.length - currentVisibleCount;
            const visibleLogs = hiddenCount > 0 ? sessionLogs.slice(-currentVisibleCount) : sessionLogs;
            return (
              <div key={sid}>
                {hiddenCount > 0 && (
                  <button
                    onClick={() => {
                      const oldStart = Math.max(0, sessionLogs.length - currentVisibleCount);
                      const newStart = Math.max(0, oldStart - CURRENT_SESSION_RENDER_STEP);
                      const added = sessionLogs.slice(newStart, oldStart).reduce((n, entry) => entry.type === 'marker' ? n : n + 1, 0);
                      setCurrentVisibleCount(prev => prev + CURRENT_SESSION_RENDER_STEP);
                      // 토스트가 이미 '추가 표시' 상태로 떠 있으면 누적, 아니면 새로 시작
                      setToast(prev => prev?.mode === 'shown' ? { mode: 'shown', added: prev.added + added } : { mode: 'shown', added });
                    }}
                    className="text-secondary-text-color/40 hover:text-secondary-text-color transition-colors cursor-pointer text-[10px] py-0.5"
                  >
                    ▴ 이전 줄 {hiddenCount.toLocaleString()}줄 더보기
                  </button>
                )}
                {visibleLogs.map((entry, i) => (
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
                ))}
              </div>
            );
          })
        }
        <div ref={logEndRef} />
      </div>

      {/* 우측 하단: 로딩 진행 표시와 "표시된 로그 수" 안내를 각각 독립적으로 쌓아서 동시에 보일 수 있게 한다 */}
      <div className="pointer-events-none absolute bottom-3 right-3 flex flex-col items-end gap-2">
        {toast && (
          <div className="flex items-center gap-2 rounded-md border border-border-color bg-modal-background-color/90 px-2.5 py-1.5 text-[10px] text-secondary-text-color shadow-md backdrop-blur-sm transition-opacity duration-300">
            <Check className="w-3 h-3 shrink-0 text-service-color" />
            <span>
              {toast.mode === 'loaded'
                ? `최근 로그 ${renderedLogCount.toLocaleString()}개를 불러와서 표시했습니다`
                : `로그 ${toast.added.toLocaleString()}개를 추가로 표시했습니다`}
            </span>
          </div>
        )}
        {loadingLabel && (
          <div className="flex items-center gap-2 rounded-md border border-border-color bg-modal-background-color/90 px-2.5 py-1.5 text-[10px] text-secondary-text-color shadow-md backdrop-blur-sm transition-opacity duration-300">
            <Loader2 className="w-3 h-3 shrink-0 animate-spin" />
            <span>{loadingLabel}</span>
            {isLoadingHistory && (
              <div className="h-1 w-20 shrink-0 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-service-color transition-all duration-150"
                  style={{ width: `${logLoadProgress.percent}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
