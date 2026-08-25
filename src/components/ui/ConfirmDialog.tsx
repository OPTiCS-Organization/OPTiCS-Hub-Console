import { useId, useState, type ReactNode } from "react";
import { Check, Loader2 } from "lucide-react";
import { dangerSolidButtonClass } from "../../constants/danger";

/**
 * 되돌리기 어려운 동작을 실행하기 전에 띄우는 확인창의 본문.
 *
 * 모달은 열릴 때의 ReactNode를 그대로 보관하므로 부모의 상태 변화가 반영되지 않는다.
 * 동의 여부와 전송 중 상태를 이 컴포넌트가 직접 들고 있어야 버튼이 실제로 반응한다.
 *
 * 마찰의 세기는 "되돌릴 수 있는가"로만 정한다. 화면마다 다른 잣대를 쓰면
 * 사용자가 마찰의 크기로 위험을 가늠할 수 없게 된다.
 * - simple      : 되돌릴 수 있다. 버튼 두 개면 충분하다.
 * - acknowledge : 중단을 동반하지만 복구할 수 있다. 무엇을 감수하는지 체크로 확인받는다.
 * - phrase      : 데이터가 사라진다. 이름을 그대로 입력해야만 실행된다.
 */

export type ConfirmFriction =
  | { kind: 'simple' }
  | { kind: 'acknowledge'; label: string }
  | { kind: 'phrase'; phrase: string; label: string };

export interface ConfirmImpact {
  icon: ReactNode;
  title: string;
  detail?: string;
  /** 사용자가 놓치면 안 되는 항목. 아이콘만 색을 올리고 본문은 평소 잉크를 쓴다. */
  emphasis?: boolean;
}

interface ConfirmDialogProps {
  /** 무엇에 대한 동작인지. 대상이 여럿인 화면에서 열릴 때 특히 중요하다. */
  target?: { name: string; detail?: string; icon?: ReactNode };
  /** 사용자가 잃거나 감수하는 것들. */
  impacts?: ConfirmImpact[];
  /** 대상 카드와 실행 버튼의 톤. 파괴적이지 않은 동작은 accent 를 쓴다. */
  tone?: 'danger' | 'accent';
  friction: ConfirmFriction;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  /** 2FA 코드처럼 확인에 필요한 추가 입력. 영향 목록과 마찰 사이에 놓인다. */
  children?: ReactNode;
}

const TONE = {
  danger: {
    card: 'border-danger-color/25 bg-danger-color/5',
    icon: 'text-danger-color',
    emphasis: 'text-danger-color',
    inputFocus: 'focus:border-danger-color',
    confirm: dangerSolidButtonClass,
  },
  accent: {
    card: 'border-service-color/25 bg-service-color/5',
    icon: 'text-service-color',
    emphasis: 'text-warning-color',
    inputFocus: 'focus:border-service-color',
    confirm:
      'inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-sm bg-service-color px-3.5 ' +
      'text-xs font-semibold leading-none text-on-accent-color transition-opacity cursor-pointer ' +
      'hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40 ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-service-color/50',
  },
} as const;

function Impact({ icon, title, detail, emphasis, tone }: ConfirmImpact & { tone: 'danger' | 'accent' }) {
  return (
    <div className="flex gap-2.5">
      <span className={`mt-px shrink-0 ${emphasis ? TONE[tone].emphasis : 'text-tertiary-text-color'}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-2xs leading-tight font-medium text-primary-text-color break-keep">{title}</p>
        {detail && (
          <p className="mt-0.5 text-2xs leading-snug text-secondary-text-color break-keep">{detail}</p>
        )}
      </div>
    </div>
  );
}

export default function ConfirmDialog({
  target,
  impacts,
  tone = 'danger',
  friction,
  confirmLabel,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const inputId = useId();
  const [acknowledged, setAcknowledged] = useState(false);
  const [typed, setTyped] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const satisfied =
    friction.kind === 'simple' ? true
      : friction.kind === 'acknowledge' ? acknowledged
        : typed.trim() === friction.phrase;

  // Tailwind 는 소스에서 완성된 클래스 문자열을 찾아 CSS 를 만든다.
  // `bg-${accent}/5` 처럼 조립하면 그 클래스는 아예 생성되지 않으므로 전부 적어 둔다.
  const toneClass = TONE[tone];

  async function run() {
    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {target && (
        // 대상 카드부터 톤을 입혀야 확인창 전체가 중립 회색으로 읽히지 않는다.
        <div className={`flex items-center gap-3 rounded-md border px-3 py-2 ${toneClass.card}`}>
          {target.icon && <span className={`shrink-0 ${toneClass.icon}`}>{target.icon}</span>}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-primary-text-color">{target.name}</p>
            {/* 이름과 같은 값이면 두 줄로 찍지 않는다. */}
            {target.detail && target.detail !== target.name && (
              <p className="truncate font-mono text-3xs text-secondary-text-color">{target.detail}</p>
            )}
          </div>
        </div>
      )}

      {impacts && impacts.length > 0 && (
        <div className="flex flex-col gap-3">
          {impacts.map(impact => (
            <Impact key={impact.title} {...impact} tone={tone} />
          ))}
        </div>
      )}

      {children}

      {friction.kind === 'phrase' && (
        /*
          예전에는 안내 문구 / 문구 표시 상자 / 입력칸 세 덩어리가 쌓여 있었다.
          표시 상자가 입력칸과 똑같이 생겨 어디에 쓰는 건지 헷갈렸고, 같은 문구가
          표시 상자와 placeholder 에 두 번 나왔다. 안내 안에 칩으로 넣어 한 덩어리를 줄인다.
        */
        <div className="flex flex-col gap-2">
          <label htmlFor={inputId} className="text-2xs leading-relaxed text-secondary-text-color break-keep">
            {friction.label}{' '}
            {/* select-all: 한 번 클릭하면 문구 전체가 잡혀 그대로 복사할 수 있다.
                확인의 목적은 타자 연습이 아니라 무엇을 지우는지 한 번 더 읽게 만드는 것이다. */}
            <code className="mx-0.5 inline-block select-all rounded-sm bg-white/8 px-1.5 py-0.5 align-[0.05em] font-mono text-2xs break-all text-primary-text-color">
              {friction.phrase}
            </code>
          </label>
          {/* 다 입력했는지는 실행 버튼이 켜지는 것으로만 알 수 있었다. 버튼은 시선에서
              멀어 한 글자 틀린 것을 눈치채기 어려우므로, 입력칸 안에서 바로 알려 준다. */}
          <div className="relative">
            <input
              id={inputId}
              value={typed}
              onChange={event => setTyped(event.target.value)}
              disabled={submitting}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={typed.length > 0 && !satisfied}
              className={`h-9 w-full rounded-sm border border-border-color bg-modal-box-color pl-3 pr-9 font-mono text-xs text-primary-text-color outline-none transition-colors ${toneClass.inputFocus}`}
            />
            {satisfied && (
              <Check className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-success-color" />
            )}
          </div>
        </div>
      )}

      {/* 동의와 실행을 같은 행에 두면 무엇에 동의하고 무엇을 누르는지가 한 묶음으로 읽힌다. */}
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-border-color pt-3 ${friction.kind === 'acknowledge' ? 'justify-between' : 'justify-end'}`}>
        {friction.kind === 'acknowledge' && (
          <label htmlFor={inputId} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
            <input
              id={inputId}
              type="checkbox"
              checked={acknowledged}
              onChange={event => setAcknowledged(event.target.checked)}
              disabled={submitting}
              className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-service-color"
            />
            <span className={`text-2xs leading-snug break-keep transition-colors ${acknowledged ? 'text-primary-text-color' : 'text-secondary-text-color'}`}>
              {friction.label}
            </span>
          </label>
        )}

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="inline-flex h-8 items-center justify-center rounded-sm border border-border-color px-3.5 text-xs text-secondary-text-color transition-colors hover:bg-white/5 hover:text-primary-text-color cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong-color"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => { void run(); }}
            disabled={!satisfied || submitting}
            className={toneClass.confirm}
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
