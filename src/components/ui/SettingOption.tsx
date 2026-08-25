import { useId, useState, type ReactNode } from "react";
import { dangerSoftButtonClass } from "../../constants/danger";

// eslint-disable-next-line react-refresh/only-export-components
export enum SettingType {
  Button = 'Button',
  Toggle = 'Toggle',
  Button_Danger = 'Button_Danger',
  Input = 'Input',
}

function ActionButton({ label, onClick, danger, disabled }: { label: string; onClick?: () => void; danger?: boolean; disabled?: boolean }) {
  // danger 변형은 constants/danger.ts 의 soft 규격을 그대로 쓴다. 설정 목록 안에 섞여
  // 있는 버튼이라 시선을 끌면 안 되는 자리이기 때문이다(문서 참고). 크기/폭은 이 컴포넌트가
  // 정하고, 고정 높이 + items-center 로 잡아 글자가 위로 쏠리던 문제를 없앤다.
  if (danger) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`inline-flex h-8 items-center justify-center px-3.5 text-xs font-semibold ${dangerSoftButtonClass}`}
      >
        {label}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 items-center justify-center rounded-sm bg-service-color px-4 text-sm font-semibold text-white cursor-pointer transition-colors duration-100 hover:bg-button-progress-color disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-service-color/50"
    >
      {label}
    </button>
  );
}

function InputAction({ id, value, onChange, placeholder, suffix, maxLength, buttonLabel, onClick, disabled }: { id: string; value?: string; onChange?: (v: string) => void; placeholder?: string; suffix?: string; maxLength?: number; buttonLabel?: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
      <div className="flex min-w-0 flex-1 items-center rounded-sm border border-border-color bg-background-color px-2 transition-colors duration-100 focus-within:border-service-color sm:flex-none">
        <input
          id={id}
          type="text"
          value={value}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          className="w-full min-w-0 bg-transparent py-1.5 text-sm text-primary-text-color outline-none placeholder:text-secondary-text-color/50 sm:w-32"
        />
        {suffix && <span className="shrink-0 text-xs text-secondary-text-color whitespace-nowrap">{suffix}</span>}
      </div>
      <ActionButton label={buttonLabel ?? "변경"} onClick={onClick} disabled={disabled} />
    </div>
  );
}

function Toggle({ value, onChange, disabled, label }: { value?: boolean; onChange?: (next: boolean) => void; disabled?: boolean; label: string }) {
  const [internal, setInternal] = useState(false);
  const isControlled = value !== undefined;
  const state = isControlled ? value : internal;

  const toggle = () => {
    if (disabled) return;
    const next = !state;
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      aria-pressed={state}
      aria-label={label}
      className={`h-5 w-10 shrink-0 rounded-full p-0.5 cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-service-color/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background-color ${state ? "bg-service-color" : "bg-border-strong-color"}`}
    >
      <div className={`h-4 w-4 rounded-full bg-white transition-transform ${state ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

type SettingOptionProps = {
  settingName: string;
  description?: string;
  type: SettingType;
  buttonLabel?: string;
  onClick?: () => void;
  value?: boolean;
  onChange?: (next: boolean) => void;
  buttonDisabled?: boolean;
  inputValue?: string;
  onInputChange?: (v: string) => void;
  inputPlaceholder?: string;
  inputSuffix?: string;
  maxLength?: number;
  toggleDisabled?: boolean;
};

export function SettingOption({ settingName, description = "", type, buttonLabel, onClick, value, onChange, buttonDisabled, inputValue, onInputChange, inputPlaceholder, inputSuffix, maxLength, toggleDisabled, }: SettingOptionProps) {
  // Input 타입에서 label과 input을 연결하기 위한 id. 항목마다 고유해야 하므로
  // settingName이 아닌 useId로 발급한다(같은 이름의 설정이 여러 페이지에 있어도 안전).
  const inputId = useId();

  let typeNode: ReactNode;
  switch (type) {
    case SettingType.Button:
      typeNode = <ActionButton label={buttonLabel ?? settingName} onClick={onClick} disabled={buttonDisabled} />;
      break;
    case SettingType.Button_Danger:
      typeNode = <ActionButton label={buttonLabel ?? settingName} onClick={onClick} danger disabled={buttonDisabled} />;
      break;
    case SettingType.Toggle:
      typeNode = <Toggle value={value} onChange={onChange} disabled={toggleDisabled} label={settingName} />;
      break;
    case SettingType.Input:
      typeNode = <InputAction id={inputId} value={inputValue} onChange={onInputChange} placeholder={inputPlaceholder} suffix={inputSuffix} maxLength={maxLength} buttonLabel={buttonLabel} onClick={onClick} disabled={buttonDisabled} />;
      break;
  }

  // 이름/설명 블록에는 type이 Input일 때만 label 역할을 맡긴다. Button·Toggle은
  // 버튼/토글 자체가 접근 가능한 이름(label 텍스트, aria-label)을 이미 갖고 있다.
  const NameTag = type === SettingType.Input ? "label" : "span";
  const nameProps = type === SettingType.Input ? { htmlFor: inputId } : {};

  return (
    // 설명 유무와 무관하게 정렬이 유지되도록 grid 대신 flex를 쓴다. 이름/설명은 한 덩어리로
    // 묶여 위에서 아래로 쌓이고, 컨트롤은 세로 중앙 정렬로 나란히 붙는다. 좁은 화면에서는
    // 긴 이름·서브도메인이 컨트롤과 겹치지 않도록 세로로 쌓는다.
    // 바깥 여백은 갖지 않는다 — 목록 안 항목 간 간격은 부모(Section)가 관리한다.
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <NameTag {...nameProps} className="block text-sm font-semibold text-primary-text-color break-keep">
          {settingName}
        </NameTag>
        {description && (
          <p className="mt-1 text-xs leading-relaxed text-secondary-text-color break-keep">{description}</p>
        )}
      </div>
      <div className="flex shrink-0 sm:justify-end">
        {typeNode}
      </div>
    </div>
  )
}
