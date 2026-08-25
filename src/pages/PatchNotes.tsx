import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { patchNotes, changeKindLabel, changeKindDotClass, changeKindOrder, badgeBaseClass, currentBadgeClass, importantBadgeClass, betaBadgeClass, partialFixBadgeClass, partialFixBadgeHint } from "../constants/patchNotes";
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
    <div className="text-primary-text-color mt-16 w-full max-w-4xl mx-auto">

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
            <div key={note.version} className="relative pl-6 pb-8">
              {/* 선을 컨테이너의 border-l 로 그리면 항목 맨 위에서 시작해 점 위로 꼬리가
                  삐져나오고, 버전 제목 왼쪽에 선이 나란히 붙어 보인다. 점 아래에서
                  시작하도록 따로 그려야 다음 항목으로 이어지는 타임라인으로 읽힌다. */}
              {index !== patchNotes.length - 1 && (
                <span aria-hidden className="absolute top-5 bottom-0 left-0 w-px bg-border-strong-color" />
              )}
              {/* Tailwind preflight 가 box-sizing:border-box 를 걸어 두므로 w-2 는 테두리를
                  포함한 8px 이다. 점 중심 = left + 4, 선(1px, x=0~1) 중심 = 0.5 이므로
                  left 는 -3.5px 여야 한다. */}
              <span
                className={`absolute -left-[3.5px] top-1.5 h-2 w-2 rounded-full border-2 border-background-color ${
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
                {/* 버전은 아래 컴포넌트 표와 같은 mono 로, 코드네임은 그 부제로 읽히게 둔다.
                    italic 은 이 화면에서 여기에만 쓰이던 예외라 걷어냈다. */}
                <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-mono text-sm font-semibold text-primary-text-color">{note.version}</span>
                  {note.codename && (
                    <span className="text-sm text-secondary-text-color">{note.codename}</span>
                  )}
                  {isCurrent && (
                    <span className={`${badgeBaseClass} ${currentBadgeClass}`}>Current</span>
                  )}
                  {note.highlight && !isCurrent && (
                    <span className={`${badgeBaseClass} ${importantBadgeClass}`}>Important</span>
                  )}
                </div>

                <span className="mb-4 block text-xs text-tertiary-text-color">{formatDate(note.date)}</span>

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
                          <span className="text-3xs font-semibold uppercase tracking-widest text-secondary-text-color">
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
                                {change.beta && (
                                  <span className={`mr-1.5 align-[0.1em] ${badgeBaseClass} ${betaBadgeClass}`}>
                                    BETA
                                  </span>
                                )}
                                {change.partialFix && (
                                  <span
                                    title={partialFixBadgeHint}
                                    className={`mr-1.5 align-[0.1em] ${badgeBaseClass} ${partialFixBadgeClass}`}
                                  >
                                    PARTIAL FIX
                                  </span>
                                )}
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
