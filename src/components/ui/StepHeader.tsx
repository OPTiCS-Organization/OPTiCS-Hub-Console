export default function StepHeader({ email, onBack, label }: { email: string; onBack: () => void; label: string }) {
  return (
    <div>
      <p className="text-primary-text-color font-semibold text-sm mb-1">{label}</p>
      <div className="flex items-center gap-1.5">
        <span className="text-secondary-text-color text-xs">{email}</span>
        <button
          type="button" onClick={onBack}
          aria-label={`${email} 변경`}
          className="text-service-color text-xs hover:underline cursor-pointer rounded-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-service-color/50"
        >
          변경
        </button>
      </div>
    </div>
  );
}
