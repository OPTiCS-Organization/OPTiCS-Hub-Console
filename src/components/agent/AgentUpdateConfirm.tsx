import { ArrowRight, Network, RotateCcw, ScrollText, Timer } from "lucide-react";
import ConfirmDialog from "../ui/ConfirmDialog";

/**
 * 업데이트 확인창.
 *
 * 실패하면 이전 버전으로 자동 복구되므로 파괴적이지는 않다. 다만 교체 동안 라우팅이
 * 끊기므로 L2 — 체크박스로 동의를 받는다. 톤은 위험이 아니라 액센트를 쓴다.
 */
export default function AgentUpdateConfirm({
  agentName,
  currentVersion,
  targetVersion,
  onConfirm,
  onCancel,
}: {
  agentName: string;
  currentVersion: string | null;
  targetVersion: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  return (
    <ConfirmDialog
      tone="accent"
      target={{
        name: agentName,
        // 어느 버전에서 어디로 가는지가 대상 카드에서 바로 읽혀야 한다.
        detail: `${currentVersion ?? '알 수 없음'} → ${targetVersion}`,
        icon: <ArrowRight className="h-4 w-4" />,
      }}
      impacts={[
        {
          icon: <Timer className="h-3.5 w-3.5" />,
          title: '5~10초 동안 에이전트 연결이 끊깁니다',
          detail: '교체가 끝나면 자동으로 다시 연결됩니다.',
        },
        {
          emphasis: true,
          icon: <Network className="h-3.5 w-3.5" />,
          title: '서비스 라우팅이 그동안 중단됩니다',
          detail: '배포된 컨테이너는 계속 실행되지만, 이 에이전트를 경유하는 외부 요청은 실패할 수 있습니다.',
        },
        {
          icon: <ScrollText className="h-3.5 w-3.5" />,
          title: '진행 중인 배포·로그 수집·웹 터미널이 중단됩니다',
        },
        {
          icon: <RotateCcw className="h-3.5 w-3.5" />,
          title: '새 버전이 시작에 실패하면 자동으로 되돌아갑니다',
        },
      ]}
      friction={{ kind: 'acknowledge', label: '라우팅 중단을 포함한 위 내용을 확인했습니다.' }}
      confirmLabel="업데이트"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
