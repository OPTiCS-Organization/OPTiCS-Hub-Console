import { useState, type ReactNode } from "react";

export enum SettingType {
  Button = 'Button',
  Toggle = 'Toggle',
  Button_Danger = 'Button_Danger',
}

function ActionButton({ label, onClick, danger }: { label: string; onClick?: () => void; danger?: boolean }) {
  const variant = danger ? "bg-red-600 hover:bg-red-700" : "bg-service-color hover:bg-button-progress-color";
  return (
    <button type="button" onClick={onClick} className={`text-white text-sm font-semibold px-4 py-1.5 rounded-sm cursor-pointer transition-colors duration-100 ${variant}`}>
      {label}
    </button>
  );
}

function Toggle({ value, onChange }: { value?: boolean; onChange?: (next: boolean) => void }) {
  const [internal, setInternal] = useState(false);
  const isControlled = value !== undefined;
  const state = isControlled ? value : internal;

  const toggle = () => {
    const next = !state;
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };

  return (
    <div onClick={toggle} className={`w-10 h-5 rounded-full cursor-pointer transition-colors p-0.5 ${state ? "bg-service-color" : "bg-gray-500"}`}>
      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${state ? "translate-x-5" : "translate-x-0"}`} />
    </div>
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
};

export function SettingOption({ settingName, description = "", type, buttonLabel, onClick, value, onChange, }: SettingOptionProps) {
  let typeNode: ReactNode;
  switch (type) {
    case SettingType.Button:
      typeNode = <ActionButton label={buttonLabel ?? settingName} onClick={onClick} />;
      break;
    case SettingType.Button_Danger:
      typeNode = <ActionButton label={buttonLabel ?? settingName} onClick={onClick} danger />;
      break;
    case SettingType.Toggle:
      typeNode = <Toggle value={value} onChange={onChange} />;
      break;
  }
  return (
    <div className="grid-cols-[2fr_1fr] grid-rows-2 grid">
      <span className="col-span-1 text-md font-semibold">{settingName}</span>
      <div className="col-span-1 row-span-2 justify-end flex items-center">
        {typeNode}
      </div>
      <span className="col-span-1 text-sm text-gray-300">{description}</span>
    </div>
  )
}
