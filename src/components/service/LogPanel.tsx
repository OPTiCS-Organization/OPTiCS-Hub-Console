import { Terminal } from "lucide-react";
import type { LogEntry } from "../../hooks/useServiceLog";

function formatTimestamp(timestamp: string): string {
  const d = new Date(timestamp);
  const ampm = d.getHours() < 12 ? 'AM' : 'PM';
  const h = String(d.getHours() % 12 || 12).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${ampm} ${h}:${m}:${s}`;
}

interface LogPanelProps {
  logs: LogEntry[];
  currentSessionId: number;
  expandedSessions: Set<number>;
  setExpandedSessions: React.Dispatch<React.SetStateAction<Set<number>>>;
  onClear: () => void;
  logEndRef: React.RefObject<HTMLDivElement | null>;
}

export default function LogPanel({
  logs, currentSessionId, expandedSessions, setExpandedSessions, onClear, logEndRef,
}: LogPanelProps) {
  const sessions = Array.from(new Set(logs.map(e => e.sessionId))).sort((a, b) => a - b);

  return (
    <div className="border border-border-color rounded-md bg-modal-box-color flex flex-col" style={{ height: 'calc(100vh - 320px)', minHeight: '300px' }}>
      <div className="px-4 py-2.5 border-b border-border-color flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-secondary-text-color" />
          <span className="text-xs font-semibold text-primary-text-color">로그</span>
          <span className="w-1.5 h-1.5 rounded-full bg-service-color animate-pulse" />
        </div>
        <button
          onClick={onClear}
          className="text-[10px] text-secondary-text-color hover:text-primary-text-color transition-colors cursor-pointer"
        >
          지우기
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-5">
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
                    <div key={i} className="flex gap-2 opacity-40">
                      <span className="text-secondary-text-color/60 shrink-0">{formatTimestamp(entry.timestamp)}</span>
                      <span className={entry.log.startsWith('ERROR') ? 'text-red-400' : 'text-primary-text-color'}>{entry.log}</span>
                    </div>
                  ))}
                </div>
              );
            }

            return sessionLogs.map((entry, i) => (
              <div key={`${sid}-${i}`} className="flex gap-2">
                <span className="text-secondary-text-color/40 shrink-0">{formatTimestamp(entry.timestamp)}</span>
                <span className={entry.log.startsWith('ERROR') ? 'text-red-400' : 'text-primary-text-color'}>{entry.log}</span>
              </div>
            ));
          })
        }
        <div ref={logEndRef} />
      </div>
    </div>
  );
}
