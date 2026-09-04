import { useState, type ReactNode } from "react";
import { EyeOff, Megaphone, Network, Server, ShieldOff } from "lucide-react";
import ConfirmDialog from "../ui/ConfirmDialog";

export type TrafficBlockMode = 'notice' | 'hidden';

/**
 * 트래픽 차단 확인창.
 *
 * 외부 요청이 즉시 끊기지만 버튼 한 번으로 되돌아오므로 L2 — 체크박스로 동의를 받는다.
 * 컨테이너를 건드리지 않는다는 점이 STOP과의 차이라, 그 사실을 영향 목록의 첫 줄에 둔다.
 * 사용자가 이 창에서 확인해야 하는 것은 "무엇이 멈추는가"가 아니라 "무엇이 안 멈추는가"다.
 *
 * 모드와 사유를 이 컴포넌트가 직접 들고 있는 이유는 ConfirmDialog 주석에 적힌 것과 같다.
 * 모달은 열릴 때의 ReactNode를 붙잡아 두므로, 부모의 useState로는 라디오가 움직이지 않는다.
 */
export default function TrafficBlockDialog({
  serviceName,
  serviceAddress,
  onConfirm,
  onCancel,
}: {
  serviceName: string;
  serviceAddress?: string;
  onConfirm: (options: { mode: TrafficBlockMode; reason: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<TrafficBlockMode>('notice');
  const [reason, setReason] = useState('');

  return (
    <ConfirmDialog
      tone="danger"
      target={{ name: serviceName, detail: serviceAddress, icon: <ShieldOff className="h-4 w-4" /> }}
      impacts={[
        {
          icon: <Server className="h-3.5 w-3.5" />,
          title: '컨테이너는 계속 실행됩니다',
          detail: '중지가 아니라 라우팅만 닫습니다. 처리 중인 작업이나 큐는 그대로 이어집니다.',
        },
        {
          emphasis: true,
          icon: <Network className="h-3.5 w-3.5" />,
          title: '외부 요청이 즉시 끊깁니다',
          detail: '이 서비스에 걸린 모든 주소가 함께 막힙니다. 다시 열 때까지 아무도 접속할 수 없습니다.',
        },
      ]}
      friction={{ kind: 'acknowledge', label: '외부 접속 차단을 포함한 위 내용을 확인했습니다.' }}
      confirmLabel="트래픽 차단"
      onCancel={onCancel}
      onConfirm={() => onConfirm({ mode, reason })}
    >
      <div className="flex flex-col gap-2">
        <p className="text-2xs font-medium text-primary-text-color">차단된 주소로 들어온 요청에 보여줄 응답</p>

        <ModeOption
          checked={mode === 'notice'}
          onSelect={() => setMode('notice')}
          icon={<Megaphone className="h-3.5 w-3.5" />}
          title="안내 (503)"
          detail="운영자가 트래픽을 중단했다고 알려줍니다. 이용자가 장애로 오해하지 않습니다."
        />
        <ModeOption
          checked={mode === 'hidden'}
          onSelect={() => setMode('hidden')}
          icon={<EyeOff className="h-3.5 w-3.5" />}
          title="숨김 (404)"
          detail="없는 서비스인 것처럼 응답합니다. 존재를 알리고 싶지 않을 때만 고르세요."
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="traffic-block-reason" className="text-2xs font-medium text-primary-text-color">
          사유 <span className="font-normal text-tertiary-text-color">(선택 · 운영 기록용이며 오류 페이지에는 나가지 않습니다)</span>
        </label>
        <input
          id="traffic-block-reason"
          value={reason}
          onChange={event => setReason(event.target.value)}
          maxLength={500}
          autoComplete="off"
          placeholder="예: 결제 모듈 점검"
          className="h-9 w-full rounded-sm border border-border-color bg-modal-box-color px-3 text-xs text-primary-text-color outline-none transition-colors focus:border-danger-color"
        />
      </div>
    </ConfirmDialog>
  );
}

function ModeOption({
  checked,
  onSelect,
  icon,
  title,
  detail,
}: {
  checked: boolean;
  onSelect: () => void;
  icon: ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <label
      className={`flex cursor-pointer gap-2.5 rounded-md border px-3 py-2 transition-colors ${
        checked ? 'border-danger-color/40 bg-danger-color/5' : 'border-border-color hover:border-border-strong-color'
      }`}
    >
      <input
        type="radio"
        name="traffic-block-mode"
        checked={checked}
        onChange={onSelect}
        className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-danger-color"
      />
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-2xs font-medium leading-tight text-primary-text-color">
          <span className={checked ? 'text-danger-color' : 'text-tertiary-text-color'}>{icon}</span>
          {title}
        </p>
        <p className="mt-0.5 text-2xs leading-snug text-secondary-text-color break-keep">{detail}</p>
      </div>
    </label>
  );
}
