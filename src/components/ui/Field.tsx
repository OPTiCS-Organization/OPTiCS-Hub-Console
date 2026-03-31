export const inputCls = "w-full rounded-sm bg-modal-box-color border border-border-color px-3 py-2 text-sm text-primary-text-color placeholder:text-secondary-text-color/50 outline-none focus:border-service-color transition-colors duration-100";
export const labelCls = "text-xs text-secondary-text-color font-medium uppercase tracking-widest";

export default function Field({ label, type, value, onChange, placeholder, autoFocus, required }: {
  label: string; type: string; value: string;
  onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean; required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className={labelCls}>{label}</label>
      <input
        type={type} value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder} autoFocus={autoFocus} required={required}
        className={inputCls}
      />
    </div>
  );
}
