import { useState, type ReactNode } from "react";

// eslint-disable-next-line react-refresh/only-export-components
export enum SettingType {
  Button = 'Button',
  Toggle = 'Toggle',
  Button_Danger = 'Button_Danger',
  Input = 'Input',
}

function ActionButton({ label, onClick, danger, disabled }: { label: string; onClick?: () => void; danger?: boolean; disabled?: boolean }) {
  const variant = danger ? "hover:bg-red-700 border border-red-700" : "bg-service-color hover:bg-button-progress-color";
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`text-white text-sm font-semibold px-4 pt-1.5 pb-2.5 rounded-sm cursor-pointer transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed ${variant}`}>
      {label}
    </button>
  );
}

function InputAction({ value, onChange, placeholder, suffix, maxLength, buttonLabel, onClick, disabled }: { value?: string; onChange?: (v: string) => void; placeholder?: string; suffix?: string; maxLength?: number; buttonLabel?: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-2 w-full justify-end">
      <div className="flex items-center rounded-sm bg-background-color border border-border-color px-2 focus-within:border-service-color transition-colors duration-100 min-w-0">
        <input
          type="text"
          value={value}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          className="bg-transparent py-1.5 text-sm text-primary-text-color placeholder:text-secondary-text-color/50 outline-none w-32 min-w-0"
        />
        {suffix && <span className="text-xs text-secondary-text-color whitespace-nowrap">{suffix}</span>}
      </div>
      <ActionButton label={buttonLabel ?? "변경"} onClick={onClick} disabled={disabled} />
    </div>
  );
}

function Toggle({ value, onChange, disabled }: { value?: boolean; onChange?: (next: boolean) => void; disabled?: boolean }) {
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
    <button type="button" onClick={toggle} disabled={disabled} aria-pressed={state} className={`w-10 h-5 rounded-full cursor-pointer transition-colors p-0.5 disabled:cursor-not-allowed disabled:opacity-40 ${state ? "bg-service-color" : "bg-gray-500"}`}>
      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${state ? "translate-x-5" : "translate-x-0"}`} />
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
  let typeNode: ReactNode;
  switch (type) {
    case SettingType.Button:
      typeNode = <ActionButton label={buttonLabel ?? settingName} onClick={onClick} disabled={buttonDisabled} />;
      break;
    case SettingType.Button_Danger:
      typeNode = <ActionButton label={buttonLabel ?? settingName} onClick={onClick} danger disabled={buttonDisabled} />;
      break;
    case SettingType.Toggle:
      typeNode = <Toggle value={value} onChange={onChange} disabled={toggleDisabled} />;
      break;
    case SettingType.Input:
      typeNode = <InputAction value={inputValue} onChange={onInputChange} placeholder={inputPlaceholder} suffix={inputSuffix} maxLength={maxLength} buttonLabel={buttonLabel} onClick={onClick} disabled={buttonDisabled} />;
      break;
  }
  return (
    <div className="mt-5 grid-cols-[2fr_1fr] grid-rows-2 grid">
      <span className="col-span-1 text-md font-semibold">{settingName}</span>
      <div className="col-span-1 row-span-2 justify-end flex items-center">
        {typeNode}
      </div>
      <span className="col-span-1 text-sm text-gray-300">{description}</span>
    </div>
  )
}
