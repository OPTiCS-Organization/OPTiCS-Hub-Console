import { useCallback, useEffect, useRef, useState } from "react";
import { Ban, Loader2, Undo2 } from "lucide-react";
import { useAuth } from "../../context/Auth.context";
import { apiFetch } from "../../lib/apiFetch";
import { badgeBaseClass, betaBadgeClass } from "../../constants/patchNotes";

/** Hub의 릴리즈 카탈로그가 내려주는 한 줄. GET /v1/release/agent */
export type AgentRelease = {
  version: string;
  channel: "stable" | "beta";
  protocol: number;
  notes: string | null;
  publishedAt: string;
  /** GitHub에서 사라진 릴리즈. 이미 그 버전을 쓰는 Agent가 있어 목록에는 남는다. */
  yanked: boolean;
  installable: boolean;
  /** 설치할 수 없는 이유. installable이 false일 때만 채워진다. */
  blockedReason: string | null;
  /** 운영자가 건 차단이라 해제할 수 있는지. 회수나 프로토콜 때문에 막힌 것은 false다. */
  manuallyBlocked: boolean;
};

/** Hub의 차단 사유 길이 제한과 맞춘다. 넘겨봐야 서버가 거절한다. */
const MAX_BLOCK_REASON_LENGTH = 200;

/**
 * Agent 릴리즈 목록.
 *
 * 두 자리에서 쓴다. Agent 상세에서는 onSelect를 받아 업데이트할 버전을 고르는 용도로,
 * 관리자 패널에서는 onSelect 없이 차단 상태를 보고 관리하는 용도로 쓴다.
 * 목록을 두 벌로 두면 차단 표시 규칙이 갈라져, 한쪽에서만 막힌 것처럼 보이는 일이 생긴다.
 *
 * 설치 가능 여부는 Hub가 판정해 내려준다. 프로토콜 지원 범위와 회수 여부를 Console이 다시
 * 계산하면 최종 관문인 assertInstallable()과 어긋나, 고를 수는 있는데 눌리지 않는 항목이 생긴다.
 *
 * administrator에게는 차단/해제를 열어 준다. 문제 있는 버전을 발견하는 자리가 곧 이 목록이므로,
 * 여기서 바로 막을 수 있어야 다른 사용자가 그 버전을 받기 전에 손쓸 수 있다.
 */
export default function ReleaseList({
  currentVersion = null,
  onSelect,
}: {
  currentVersion?: string | null;
  /** 없으면 고를 수 없는 목록이 된다. 관리자 패널처럼 보기만 하는 자리에서 쓴다. */
  onSelect?: (release: { version: string; notes: string | null }) => void;
}) {
  const { user, logout } = useAuth();
  const isAdministrator = user?.userPermission === "administrator";

  const [releases, setReleases] = useState<AgentRelease[]>([]);
  const [includeBeta, setIncludeBeta] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** 차단 사유를 입력 중인 버전. 확인 모달을 겹쳐 띄우는 대신 해당 줄을 펼친다. */
  const [blockingVersion, setBlockingVersion] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  /**
   * 마지막으로 보낸 조회의 번호.
   *
   * 채널을 빠르게 토글하거나 차단 직후 재조회가 겹치면 이전 응답이 뒤늦게 도착해
   * 최신 목록을 덮어쓴다. 번호가 어긋난 응답은 버린다.
   */
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/release/agent${includeBeta ? "?channel=beta" : ""}`,
        {},
        logout,
      );
      const body = await response.json();
      if (id !== requestId.current) return;
      if (!response.ok) throw new Error(body?.message ?? "목록을 불러오지 못했습니다.");
      setReleases(body?.data?.releases ?? []);
    } catch (caught) {
      if (id !== requestId.current) return;
      setError(caught instanceof Error ? caught.message : "목록을 불러오지 못했습니다.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [includeBeta, logout]);

  useEffect(() => { void load(); }, [load]);

  async function submitBlock(version: string) {
    const trimmed = reason.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setActionError(null);
    try {
      const response = await apiFetch(
        `/v1/release/agent/${encodeURIComponent(version)}/block`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: trimmed }),
        },
        logout,
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message ?? "차단하지 못했습니다.");
      setBlockingVersion(null);
      setReason("");
      await load();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "차단하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitUnblock(version: string) {
    if (submitting) return;

    setSubmitting(true);
    setActionError(null);
    try {
      const response = await apiFetch(
        `/v1/release/agent/${encodeURIComponent(version)}/block`,
        { method: "DELETE" },
        logout,
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message ?? "차단을 해제하지 못했습니다.");
      await load();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "차단을 해제하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  // 카탈로그는 Hub가 SemVer 순으로 정렬해 내려준다. 현재 버전보다 뒤에 있으면 그것이 곧 다운그레이드다.
  // 같은 비교 로직을 Console에 다시 두지 않으려고 순서를 그대로 신뢰한다.
  const currentIndex = releases.findIndex((release) => release.version === currentVersion);

  return (
    <div className="w-full">
      <label className="mb-3 flex cursor-pointer items-center gap-2 text-xs text-secondary-text-color">
        <input
          type="checkbox"
          checked={includeBeta}
          onChange={(event) => setIncludeBeta(event.target.checked)}
          className="accent-service-color cursor-pointer"
        />
        베타 릴리즈도 표시
      </label>

      {actionError && (
        <p className="mb-2 text-2xs text-warning-color">{actionError}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-secondary-text-color">
          <Loader2 className="h-4 w-4 animate-spin" />
          불러오는 중...
        </div>
      ) : error ? (
        <p className="py-8 text-center text-sm text-warning-color">{error}</p>
      ) : releases.length === 0 ? (
        <p className="py-8 text-center text-sm text-secondary-text-color">표시할 릴리즈가 없습니다.</p>
      ) : (
        <ul className="max-h-80 divide-y divide-border-color/60 overflow-y-auto rounded-sm border border-border-color">
          {releases.map((release, index) => {
            const isCurrent = release.version === currentVersion;
            const isDowngrade = currentIndex !== -1 && index > currentIndex;
            const selectable = Boolean(onSelect) && !isCurrent && release.installable;

            const label = (
              <>
                <span className="font-mono text-xs text-primary-text-color">{release.version}</span>
                {release.channel === "beta" && (
                  <span className={`${badgeBaseClass} ${betaBadgeClass}`}>Beta</span>
                )}
                {isCurrent && (
                  <span className="text-3xs text-secondary-text-color">현재 사용 중</span>
                )}
                {isDowngrade && !isCurrent && (
                  <span className="text-3xs text-caution-color">다운그레이드</span>
                )}
                {/* 왜 못 고르는지 적지 않으면 흐릿해진 줄이 고장으로 읽힌다. */}
                {release.blockedReason && (
                  <span className="min-w-0 truncate text-3xs text-warning-color">
                    {release.blockedReason}
                  </span>
                )}
              </>
            );

            return (
              <li key={release.version}>
                <div className="flex items-center gap-2 px-3 py-2.5">
                  {/* 고를 수 없는 목록에서는 버튼으로 만들지 않는다. 눌리지 않는 버튼을 두면
                      흐릿한 줄이 "권한이 없다"는 뜻으로 읽힌다. 차단된 줄만 흐리게 둔다. */}
                  {onSelect ? (
                    <button
                      type="button"
                      disabled={!selectable}
                      onClick={() => onSelect({ version: release.version, notes: release.notes })}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:opacity-40 cursor-pointer"
                    >
                      {label}
                    </button>
                  ) : (
                    <div className={`flex min-w-0 flex-1 items-center gap-2 ${release.installable ? "" : "opacity-60"}`}>
                      {label}
                    </div>
                  )}

                  {/* 해제할 수 없는 차단(회수/프로토콜)에는 아무 버튼도 내주지 않는다.
                      눌러도 아무 일이 없는 버튼은 권한이 없다는 뜻으로 읽힌다. */}
                  {isAdministrator && release.manuallyBlocked && (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void submitUnblock(release.version)}
                      className="inline-flex shrink-0 items-center gap-1 text-3xs text-secondary-text-color transition-colors hover:text-primary-text-color disabled:opacity-40 cursor-pointer"
                    >
                      <Undo2 className="h-3 w-3" />
                      차단 해제
                    </button>
                  )}
                  {isAdministrator && !release.blockedReason && (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => {
                        setBlockingVersion(release.version);
                        setReason("");
                        setActionError(null);
                      }}
                      className="inline-flex shrink-0 items-center gap-1 text-3xs text-secondary-text-color transition-colors hover:text-warning-color disabled:opacity-40 cursor-pointer"
                    >
                      <Ban className="h-3 w-3" />
                      차단
                    </button>
                  )}
                </div>

                {blockingVersion === release.version && (
                  <div className="border-t border-border-color/60 bg-warning-color/5 px-3 py-2.5">
                    {/* 사유가 곧 사용자에게 보이는 안내문이라는 걸 입력 시점에 알려준다. */}
                    <label className="mb-1.5 block text-3xs text-secondary-text-color">
                      차단 사유 (이 버전을 고르려는 사용자에게 그대로 표시됩니다)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={reason}
                        maxLength={MAX_BLOCK_REASON_LENGTH}
                        onChange={(event) => setReason(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") void submitBlock(release.version);
                          if (event.key === "Escape") setBlockingVersion(null);
                        }}
                        placeholder="예: 특정 조건에서 서비스가 중단되어 회수했습니다."
                        className="min-w-0 flex-1 rounded-sm border border-border-color bg-transparent px-2 py-1 text-2xs text-primary-text-color outline-none focus:border-warning-color/50"
                      />
                      <button
                        type="button"
                        disabled={!reason.trim() || submitting}
                        onClick={() => void submitBlock(release.version)}
                        className="shrink-0 rounded-sm bg-warning-color px-2.5 py-1 text-3xs font-semibold text-white transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                      >
                        차단
                      </button>
                      <button
                        type="button"
                        onClick={() => setBlockingVersion(null)}
                        className="shrink-0 text-3xs text-secondary-text-color transition-colors hover:text-primary-text-color cursor-pointer"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
