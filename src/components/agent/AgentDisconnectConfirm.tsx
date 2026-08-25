import { Ban, KeyRound, Network, Unlink } from "lucide-react";
import ConfirmDialog from "../ui/ConfirmDialog";

/**
 * 연결 해제 확인창.
 *
 * 되돌릴 수는 있으나(연결 요청부터 다시 하면 된다) 라우팅이 끊겨 서비스가 사실상
 * 멈추므로 L2 — 체크박스로 동의를 받는다. 구조와 마찰은 ConfirmDialog 가 정한다.
 */
export default function AgentDisconnectConfirm({
  agentName,
  agentCode,
  onConfirm,
  onCancel,
}: {
  agentName: string;
  agentCode: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  return (
    <ConfirmDialog
      tone="danger"
      target={{ name: agentName, detail: agentCode, icon: <Unlink className="h-4 w-4" /> }}
      impacts={[
        {
          emphasis: true,
          icon: <Network className="h-3.5 w-3.5" />,
          title: 'Service 라우팅이 즉시 끊깁니다',
          detail: '컨테이너는 계속 실행되지만, 이 Agent를 경유하는 외부 요청은 더 이상 닿지 않습니다.',
        },
        {
          emphasis: true,
          icon: <Ban className="h-3.5 w-3.5" />,
          title: '이 워크스페이스에서 아무것도 제어할 수 없습니다',
          detail: '시작·중지·재배포·삭제는 물론 로그 수집과 웹 터미널 접근도 함께 끊깁니다.',
        },
        {
          icon: <KeyRound className="h-3.5 w-3.5" />,
          title: '다시 쓰려면 연결 요청부터 새로 해야 합니다',
          detail: 'Agent 코드로 연결을 요청하고 승인을 받는 절차를 다시 거칩니다.',
        },
      ]}
      friction={{ kind: 'acknowledge', label: '라우팅 중단을 포함한 위 내용을 확인했습니다.' }}
      confirmLabel="연결 해제"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
