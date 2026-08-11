import { Loader2 } from "lucide-react";

export default function SubmitButton({ children, loading, disabled, type = "submit", onClick }: {
  children: React.ReactNode; loading?: boolean; disabled?: boolean;
  /** 폼 밖에서 쓸 때는 "button" 으로 두고 onClick 을 넘긴다. */
  type?: "submit" | "button";
  onClick?: () => void;
}) {
  return (
    <button
      type={type} onClick={onClick} disabled={loading || disabled}
      className="w-full bg-service-color hover:bg-button-progress-color disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm py-2 rounded-sm transition-colors duration-100 cursor-pointer flex items-center justify-center gap-2"
    >
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {loading ? "처리 중..." : children}
    </button>
  );
}
