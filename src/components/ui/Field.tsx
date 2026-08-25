import { useId } from "react";

export const inputCls = "w-full rounded-sm bg-modal-box-color border border-border-color px-3 py-2 text-sm text-primary-text-color placeholder:text-secondary-text-color/50 outline-none focus:border-service-color focus-visible:ring-1 focus-visible:ring-service-color/30 transition-colors duration-100";
export const labelCls = "text-xs text-secondary-text-color font-medium uppercase tracking-widest";

export default function Field({ label, type, value, onChange, placeholder, autoFocus, required }: {
  label: string; type: string; value: string;
  onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean; required?: boolean;
}) {
  // label 과 input 을 id 로 연결해 스크린리더가 포커스만으로 라벨을 읽게 한다.
  const inputId = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className={labelCls}>{label}</label>
      <input
        id={inputId}
        type={type} value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder} autoFocus={autoFocus} required={required}
        className={inputCls}
      />
    </div>
  );
}
