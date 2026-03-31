import { Loader2 } from "lucide-react";

export default function SubmitButton({ children, loading, disabled }: {
  children: React.ReactNode; loading?: boolean; disabled?: boolean;
}) {
  return (
    <button
      type="submit" disabled={loading || disabled}
      className="w-full bg-service-color hover:bg-button-progress-color disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm py-2 rounded-sm transition-colors duration-100 cursor-pointer flex items-center justify-center gap-2"
    >
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {loading ? "처리 중..." : children}
    </button>
  );
}
