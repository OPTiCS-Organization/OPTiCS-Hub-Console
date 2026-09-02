import { AlertTriangle, ArrowUpCircle, CheckCircle2 } from "lucide-react";
import type { Agent } from "./AgentCard";
import ReleaseNotes from "./ReleaseNotes";
import Tooltip from "../ui/Tooltip";

/**
 * 업데이트 가능 여부와 패치노트를 보여주는 패널.
 *
 * 버전을 고르는 드롭다운은 두지 않는다. 사용자가 답해야 하는 질문은
 * "어느 버전으로 갈까"가 아니라 "지금 올릴까 말까"이기 때문이다.
 * 특정 버전 고정이나 롤백은 예외 상황이므로, 기본 동작은 버튼 하나로 두고
 * 버전 선택은 따로 열어야 보이는 보조 동작(onPickVersion)으로 뺀다.
 */
export type AgentUpgrade = NonNullable<Agent['upgrade']>;

/** 보조 동작이므로 주 버튼과 경쟁하지 않게 채우지 않고 글자만 둔다. */
const pickVersionButtonClass = "shrink-0 text-2xs text-secondary-text-color underline-offset-2 transition-colors";
const pickVersionEnabledClass = "hover:text-primary-text-color hover:underline cursor-pointer";
const pickVersionBlockedClass = "opacity-40 cursor-not-allowed";

/**
 * 지금 쓰는 버전에 문제가 확인된 경우의 안내.
 *
 * 업데이트 알림과 같이 뜰 수 있어서 자리를 나눈다. "올릴 게 있다"와 "지금 쓰는 게 문제다"는
 * 다른 소식이고, 후자는 업데이트할 대상이 없을 때도 떠야 한다.
 */
function BlockedVersionNotice({ reason }: { reason: string }) {
  return (
    <div className="mb-2 flex items-start gap-2 rounded-md border border-warning-color/30 bg-warning-color/10 p-3">
      <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-warning-color" />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-primary-text-color">사용 중인 버전에 문제가 확인되었습니다</p>
        <p className="mt-0.5 text-2xs leading-relaxed text-secondary-text-color break-keep">{reason}</p>
      </div>
    </div>
  );
}

/**
 * 버튼이 왜 눌리지 않는지. 막을 이유가 없으면 null이고, 그때는 툴팁을 씌우지 않는다.
 * 비활성 버튼만 두고 이유를 적지 않으면 고장으로 읽힌다.
 */
function pickVersionBlockedReason(agent: Agent): string | null {
  if (!agent.remoteUpdateSupported) {
    return 'OPTiCS Agent 0.6.0 이후 버전부터 이 화면에서 버전을 고를 수 있습니다.';
  }
  if (agent.agentStatus !== 'online') {
    return '에이전트가 온라인일 때만 버전을 고를 수 있습니다.';
  }
  return null;
}

/**
 * 이유가 있을 때만 툴팁으로 감싼다.
 *
 * disabled 대신 aria-disabled를 쓴다. 브라우저는 disabled 버튼 위에서 마우스 이벤트를 아예
 * 발생시키지 않아 Tooltip의 hover가 걸리지 않고, 포커스도 받지 못해 키보드 사용자는 이유를
 * 영영 볼 수 없다. 정작 이유를 알아야 하는 상태에서만 설명이 사라지는 셈이다.
 */
function PickVersionButton({ agent, label, onPickVersion, className = "" }: {
  agent: Agent;
  label: string;
  onPickVersion: () => void;
  className?: string;
}) {
  const blockedReason = pickVersionBlockedReason(agent);

  const button = (
    <button
      type="button"
      aria-disabled={blockedReason !== null}
      onClick={blockedReason ? undefined : onPickVersion}
      className={`${pickVersionButtonClass} ${blockedReason ? pickVersionBlockedClass : pickVersionEnabledClass} ${className}`}
    >
      {label}
    </button>
  );

  if (!blockedReason) return button;
  return <Tooltip label={blockedReason} side="top">{button}</Tooltip>;
}

export default function AgentUpdatePanel({
  agent,
  onUpdate,
  onPickVersion,
}: {
  agent: Agent;
  onUpdate: (upgrade: AgentUpgrade) => void;
  onPickVersion: () => void;
}) {
  const upgrade = agent.upgrade;
  // 업데이트가 진행 중일 때는 AgentUpdateStatus가 자리를 맡는다. 두 개를 같이 띄우지 않는다.
  const inFlight = agent.updatePhase !== 'idle';
  if (inFlight) return null;

  if (!upgrade) {
    return (
      <>
        {/* 올라갈 버전이 없어도 지금 쓰는 버전이 막혔을 수 있다. 오히려 이때가 더 중요하다.
            올라갈 곳이 없다는 것은 문제를 피할 방법도 아직 없다는 뜻이기 때문이다. */}
        {agent.versionBlocked && <BlockedVersionNotice reason={agent.versionBlocked} />}
        <div className="rounded-md border border-border-color p-3 flex items-center gap-2 text-secondary-text-color">
          <CheckCircle2 className="w-3.5 h-3.5 text-success-color" />
          <span className="text-xs">최신 버전을 사용 중입니다.</span>
          {/* 최신이어도 베타를 미리 받아보거나 특정 태그로 고정할 일이 있다. */}
          <PickVersionButton
            agent={agent}
            label="다른 버전 선택"
            onPickVersion={onPickVersion}
            className="ml-auto"
          />
        </div>
      </>
    );
  }

  // 0.6.0 미만에는 update-agent 리스너가 없다. 명령을 보내면 사라지므로 버튼 대신 안내를 준다.
  if (!agent.remoteUpdateSupported) {
    return (
      <>
        {agent.versionBlocked && <BlockedVersionNotice reason={agent.versionBlocked} />}
        <div className="rounded-md border border-warning-color/25 bg-warning-color/5 p-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <ArrowUpCircle className="w-3.5 h-3.5 text-warning-color shrink-0" />
          <span className="shrink-0 text-xs font-semibold text-primary-text-color">수동 업데이트 필요</span>
          <span className="min-w-0 truncate text-3xs font-mono text-secondary-text-color">
            {agent.agentVersion ? `${agent.agentVersion} → ` : ''}{upgrade.version}
          </span>
        </div>
          <p className="text-2xs text-secondary-text-color mt-1.5">
            이 버전은 원격 업데이트를 지원하지 않습니다. Agent 호스트에서 설치 스크립트를 직접 실행하여 업데이트하세요.
            OPTiCS Agent 0.6.0 이후 버전부터는 이 화면에서 업데이트할 수 있습니다.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      {agent.versionBlocked && <BlockedVersionNotice reason={agent.versionBlocked} />}
      <div className="rounded-md border border-service-color/25 bg-service-color/5 p-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <ArrowUpCircle className="w-3.5 h-3.5 text-service-color shrink-0" />
          <span className="shrink-0 text-xs font-semibold text-primary-text-color">업데이트 가능</span>
          <span className="min-w-0 truncate text-3xs font-mono text-secondary-text-color">
            {agent.agentVersion ? `${agent.agentVersion} → ` : ''}{upgrade.version}
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <PickVersionButton agent={agent} label="다른 버전" onPickVersion={onPickVersion} />
            <button
              type="button"
              onClick={() => onUpdate(upgrade)}
              disabled={agent.agentStatus !== 'online'}
              className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-sm bg-service-color pl-3 pr-2 text-2xs font-semibold text-white transition-opacity hover:opacity-80 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
            >
              업데이트
              {/* 채운 주황 위라 패치노트의 테두리형 BETA 배지는 읽히지 않는다.
                  같은 흰 잉크를 옅게 깔아 버튼의 일부로 보이게 둔다. */}
              <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-4xs font-semibold leading-none tracking-wider">
                BETA
              </span>
            </button>
          </div>
        </div>

        {agent.agentStatus !== 'online' && (
          <p className="text-3xs text-secondary-text-color mt-1.5">
            에이전트가 온라인일 때만 업데이트할 수 있습니다.
          </p>
        )}

        {upgrade.notes && (
          <div className="mt-2.5 max-h-72 overflow-y-auto border-t border-service-color/15 pt-2.5 text-secondary-text-color">
            <ReleaseNotes source={upgrade.notes} />
          </div>
        )}
      </div>
    </>
  );
}
