import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { patchNotes, changeKindLabel, changeKindDotClass, changeKindOrder } from "../constants/patchNotes";
import packageJson from "../../package.json";
import { markPatchNotesSeen, useUnreadPatchNoteCount } from "../hooks/usePatchNoteBadge";

/** 새 버전 강조를 유지하는 시간. 이후 transition으로 서서히 지운다. */
const HIGHLIGHT_DURATION_MS = 5000;

/** YYYY-MM-DD -> 2026년 8월 11일 */
function formatDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

export default function PatchNotes() {
  // 아래 effect가 곧바로 읽음 처리를 하므로, 강조할 항목은 진입 시점 값으로 붙잡아 둔다.
  // 그래서 새 버전 강조는 릴리스 후 처음 열었을 때 한 번만 보이고 다음 방문부터는 사라진다.
  const [unreadAtMount] = useState(useUnreadPatchNoteCount());

  // 페이지를 연 것으로 읽음 처리한다. 네비게이션 배지는 구독을 통해 바로 사라진다.
  useEffect(() => { markPatchNotesSeen(); }, []);

  // 강조는 5초만 두고 지운다. 계속 켜 두면 읽는 내내 시선을 뺏는다.
  const [highlightOn, setHighlightOn] = useState(true);
  useEffect(() => {
    if (unreadAtMount <= 0) return;
    const timer = setTimeout(() => setHighlightOn(false), HIGHLIGHT_DURATION_MS);
    return () => clearTimeout(timer);
  }, [unreadAtMount]);

  return (
    <div className="text-primary-text-color mt-20 max-w-3xl">

      <div className="mb-8">
        <h1 className="text-lg font-bold mb-1">Patch Notes</h1>
        <p className="text-secondary-text-color text-sm break-keep">
          현재 OPTiCS Hub 버전은 <span className="font-mono text-primary-text-color">{packageJson.version}</span> 입니다.
        </p>
      </div>

      <div className="flex flex-col">
        {patchNotes.map((note, index) => {
          const isCurrent = note.version === packageJson.version;
          const isNew = unreadAtMount > 0 && index < unreadAtMount;

          return (
            <div key={note.version} className={`relative pl-6 pb-8 ${index === patchNotes.length - 1 ? "" : "border-l border-border-strong-color"}`}>
              <span
                className={`absolute -left-[4.5px] top-1.5 h-2 w-2 rounded-full border-2 border-background-color ${
                  isCurrent ? "bg-service-color" : "bg-border-strong-color"
                }`}
              />

              {/* 새 버전은 릴리스 후 처음 열었을 때만 강조하고, 5초 뒤 서서히 지운다. */}
              {/* 여백과 테두리 두께는 모든 항목에 늘 같게 두고 색만 전환한다. 그래야 강조가
                  사라질 때도, 강조 없는 항목과 나란히 놓일 때도 본문이 밀리지 않는다. */}
              <div
                className={`-mx-3 -mt-1.5 rounded-lg border px-3 pt-1.5 pb-3 transition-colors duration-700 ${
                  isNew && highlightOn
                    ? "border-service-color/40 bg-service-color/10"
                    : "border-transparent bg-transparent"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-primary-text-color font-semibold text-sm font-mono">{note.version}</span>
                  {note.codename && (
                    <span className="text-primary-text-color/80 text-sm italic">{note.codename}</span>
                  )}
                  {isCurrent && (
                    <span className="text-[10px] font-medium uppercase tracking-widest text-service-color">Current</span>
                  )}
                  {note.highlight && !isCurrent && (
                    <span className="text-[10px] font-medium uppercase tracking-widest text-warning-color">Important</span>
                  )}
                </div>

                <span className="text-tertiary-text-color text-xs block mb-4">{formatDate(note.date)}</span>

                {note.warning && (
                  <div className="mb-4 flex items-start gap-2.5 rounded-sm border border-warning-color/30 bg-warning-color/10 px-3 py-2.5">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-warning-color mt-px" />
                    <span className="text-warning-color text-xs leading-relaxed break-keep">
                      {note.warning}
                    </span>
                  </div>
                )}

                {note.versions && note.versions.length > 0 && (
                  <div className="mb-4 overflow-hidden rounded-sm border border-border-color">
                    {note.versions.map((entry, i) => (
                      <div
                        key={entry.scope}
                        className={`flex items-center justify-between gap-3 px-3 py-2 text-xs ${i === 0 ? "" : "border-t border-border-color/60"}`}
                      >
                        <span className="text-secondary-text-color break-keep">{entry.scope}</span>
                        <span className="shrink-0 font-mono">
                          <span className="text-tertiary-text-color">{entry.from}</span>
                          <span className="text-tertiary-text-color mx-1.5">&rarr;</span>
                          <span className={entry.from === entry.to ? "text-secondary-text-color" : "text-service-color font-semibold"}>
                            {entry.to}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  {changeKindOrder
                    .filter(kind => note.changes.some(change => change.kind === kind))
                    .map(kind => (
                      <div key={kind}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${changeKindDotClass[kind]}`} />
                          <span className="text-[10px] font-semibold uppercase tracking-widest text-secondary-text-color">
                            {changeKindLabel[kind]}
                          </span>
                        </div>
                        <ul className="flex flex-col gap-1.5 pl-3">
                          {note.changes
                            .filter(change => change.kind === kind)
                            .map((change, i) => (
                              /*
                                break-keep: 한글을 어절 단위로 끊는다. 없으면 "이메일 인" / "증" 처럼 단어 중간에서 갈린다.
                                wrap-break-word: 한 줄에 못 담는 긴 토큰만 예외적으로 쪼개 가로 넘침을 막는 안전망.
                              */
                              <li
                                key={i}
                                className="text-secondary-text-color text-sm leading-relaxed break-keep wrap-break-word text-pretty relative before:absolute before:-left-3 before:text-tertiary-text-color before:content-['·']"
                              >
                                {change.description}
                              </li>
                            ))}
                        </ul>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-tertiary-text-color text-xs mt-4 break-keep">
        이전 버전의 변경 내역은 저장소의 커밋 기록에서 확인하실 수 있습니다.
      </p>
    </div>
  );
}
