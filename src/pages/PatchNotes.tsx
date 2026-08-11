import { AlertTriangle } from "lucide-react";
import { patchNotes, changeKindLabel, changeKindDotClass, changeKindOrder } from "../constants/patchNotes";
import packageJson from "../../package.json";

/** YYYY-MM-DD -> 2026년 8월 11일 */
function formatDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

export default function PatchNotes() {
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

          return (
            <div key={note.version} className={`relative pl-6 pb-8 ${index === patchNotes.length - 1 ? "" : "border-l border-border-strong-color"}`}>
              <span
                className={`absolute -left-[4.5px] top-1.5 h-2 w-2 rounded-full border-2 border-background-color ${
                  isCurrent ? "bg-service-color" : "bg-border-strong-color"
                }`}
              />

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
          );
        })}
      </div>

      <p className="text-tertiary-text-color text-xs mt-4 break-keep">
        이전 버전의 변경 내역은 저장소의 커밋 기록에서 확인하실 수 있습니다.
      </p>
    </div>
  );
}
